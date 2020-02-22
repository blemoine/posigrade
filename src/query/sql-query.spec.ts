import { Client } from 'pg';
import { SqlQuery } from './sql-query';
import { deser } from '../serde/SqlDeserializer';

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
  test('it should create a simple ConnectionIO executing the query', async () => {
    const query = new SqlQuery({ text: 'SELECT 12 UNION SELECT 678' });
    const result = await query.list(deser.toInteger).run(client);

    expect(result).toStrictEqual([12, 678]);
  });
});
