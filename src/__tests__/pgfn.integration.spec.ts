import { Pool } from 'pg';
import { sql } from '../query/sql-parser';
import { deser, namedDeser, sequenceDeser, sequenceDeserRecord } from '../serde/SqlDeserializer';
import { ConnectionIO } from '..';

describe('sql-query', () => {
  let pool: Pool;
  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  });
  afterAll(() => {
    pool.end();
  });

  test('should be able to create tables and fill them', async () => {
    const createCarTable = sql`CREATE TABLE car ( id SERIAL, name TEXT DEFAULT NULL, date TIMESTAMPTZ)`.update();
    const carName = 'titine';
    const date = new Date('2020-02-03T05:06:07Z');
    const date2 = new Date('2021-05-15T15:16:17Z');
    const insertCar = sql`INSERT INTO car(name, date) VALUES (${carName}, ${date}), (null, ${date2}) RETURNING *`.list(
      sequenceDeser(deser.toInteger, deser.toString.or(deser.toNull), deser.toDate)
    );

    const cio = createCarTable.flatMap(() => insertCar);

    const result = await cio.transact(pool);

    expect(result).toStrictEqual([
      [1, carName, date],
      [2, null, date2],
    ]);
  });

  test('should support an easy creation of object', async () => {
    const animalSpecies = 'rat';
    const date = new Date('2020-02-03T05:06:07Z');

    const animalDeserializer = sequenceDeserRecord({
      id: namedDeser.toInteger('id'),
      species: namedDeser.toString('species'),
      creationDate: namedDeser.toDate('date'),
    });

    const createAnimalTable = sql`CREATE TABLE animals ( id SERIAL, species TEXT, date TIMESTAMPTZ)`.update();
    const insertAnimal = sql`INSERT INTO animals(species, date) VALUES (${animalSpecies}, ${date})`.update();
    const selectFirstAnimal = sql`SELECT id, species, date FROM animals LIMIT 1`.unique(animalDeserializer);

    const cio = createAnimalTable.flatMap(() => insertAnimal).flatMap(() => selectFirstAnimal);

    const result = await cio.transact(pool);

    expect(result).toStrictEqual({
      id: 1,
      species: animalSpecies,
      creationDate: date,
    });
  });

  test('should rollback if there is one error', async () => {
    const createSportTable = sql`CREATE TABLE sports (id SERIAL, name TEXT NOT NULL)`.update();
    await createSportTable.transact(pool);

    const insert1 = sql`INSERT INTO sports (name) VALUES ('soccer')`.update();

    const cio1 = insert1.flatMap(() => {
      throw new Error('Expected error');
    });

    try {
      await cio1.transact(pool);
      fail('This call should fail');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e.message).toBe('Expected error');
    }

    const insertedRows = await sql`SELECT COUNT(*) FROM sports`.unique(deser.toBigInt).transact(pool);

    expect(insertedRows).toBe(BigInt('0'));
  });

  test('IN queries should work seamlessly', async () => {
    const spotlessBooks = ['Spotless', 'Beating Ruby', 'Crystal Whisperer', 'Butterfly in Amber'];
    const stillBooks = ['Still'];
    const silverlegsBooks = ['Silverlegs'];

    const createBookTable = sql`CREATE TABLE books(id SERIAL, title TEXT NOT NULL, serie TEXT DEFAULT NULL)`.update();
    const insertFn = (title: string, serie: string | null): ConnectionIO<void> =>
      sql`INSERT INTO books(title, serie) VALUES(${title}, ${serie})`.update();
    const cio = createBookTable.flatMap(() => {
      const [first, ...tail] = [
        ...spotlessBooks.map((title) => insertFn(title, 'Spotless')),
        ...stillBooks.map((title) => insertFn(title, null)),
        ...silverlegsBooks.map((title) => insertFn(title, null)),
      ];
      return first.zip(...tail);
    });

    const stillAndSilverlegs = [...stillBooks, ...silverlegsBooks];
    const result = await cio
      .flatMap(() =>
        sql`SELECT title FROM books WHERE title <> ALL(${stillAndSilverlegs})`
          .list(deser.toString)
          .zip(
            sql`SELECT title FROM books WHERE title =  ANY(${stillAndSilverlegs})`.list(deser.toString),
            sql`SELECT title FROM books WHERE title =  ANY(${[]})`.list(deser.toString)
          )
      )
      .transact(pool);

    expect(result).toStrictEqual([spotlessBooks, stillAndSilverlegs, []]);
  });

  test('Invalid SQL query should be displayed in error', async () => {
    const c1 = sql`SELECT 12`.unique(deser.toInteger);
    const c2 = sql`SEL ECT 13`.unique(deser.toInteger);

    try {
      await c1.flatMap(() => c2).transact(pool);
      fail('This query should fail');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe("Error on query 'SEL ECT 13': 'syntax error at or near \"SEL\"'");
    }
  });

  test('should support nested deserializer', async () => {
    const createOrgTable = sql`CREATE TABLE organizations(id SERIAL, name TEXT, street TEXT, city TEXT, country TEXT)`.update();
    const insertAnOrg = sql`INSERT INTO organizations(name, street, city, country) VALUES ('Acme', '1 random street', 'Montreal', 'CANADA')`.update();

    const addressDeserializer = sequenceDeserRecord({
      street: namedDeser.toString('street'),
      city: namedDeser.toString('city'),
      country: namedDeser.toString('country'),
    });
    const orgDeserializer = sequenceDeserRecord({
      id: namedDeser.toInteger('id'),
      name: namedDeser.toString('name'),
      address: addressDeserializer,
    });
    const selectOrg = sql`SELECT * FROM organizations`.unique(orgDeserializer);

    const result = await createOrgTable
      .flatMap(() => insertAnOrg)
      .flatMap(() => selectOrg)
      .transact(pool);

    expect(result).toStrictEqual({
      id: 1,
      name: 'Acme',
      address: {
        street: '1 random street',
        city: 'Montreal',
        country: 'CANADA',
      },
    });
  });
});
