import { Client } from 'pg';
import { sql } from '../query/sql-parser';
import { deser, sequenceDeser } from '../serde/SqlDeserializer';

describe('sql-query', () => {
  let client: Client;
  beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
  });
  afterAll(() => {
    client.end();
  });

  test('should be able to create tables and fill them', async () => {
    const createCarTable = sql`CREATE TABLE car ( id SERIAL, name TEXT DEFAULT NULL, date TIMESTAMPTZ)`;

    const carName = 'titine';
    const date = new Date('2020-02-03T05:06:07Z');
    const date2 = new Date('2021-05-15T15:16:17Z');
    const insertCar = sql`INSERT INTO car(name, date) VALUES (${carName}, ${date}), (null, ${date2}) RETURNING *`;
    await createCarTable.update().run(client);

    const result = await insertCar
      .list(sequenceDeser(deser.toInteger, deser.toString.or(deser.toNull), deser.toDate))
      .run(client);

    expect(result).toStrictEqual([
      [1, carName, date],
      [2, null, date2],
    ]);
  });
});