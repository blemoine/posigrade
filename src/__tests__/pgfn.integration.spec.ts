import { Pool } from 'pg';
import { sql } from '../query/sql-parser';
import { deser, namedDeser, sequenceDeser, sequenceDeserRecord } from '../serde/SqlDeserializer';

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
});
