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
  test('should create a simple ConnectionIO executing the query', async () => {
    const query = new SqlQuery({ text: 'SELECT 12 UNION SELECT 678' });
    const result = await query.list(deser.toInteger).run(client);

    expect(result).toStrictEqual([12, 678]);
  });

  describe('unique', () => {
    test('should return one unique value from a query', async () => {
      const query = new SqlQuery({ text: 'SELECT 12' });
      const result = await query.unique(deser.toInteger).run(client);

      expect(result).toStrictEqual(12);
    });

    test('should fail if there more than one row', async () => {
      const query = new SqlQuery({ text: 'SELECT 12 UNION SELECT 987' });
      try {
        await query.unique(deser.toInteger).run(client);
        fail('This call should fail');
      } catch (e) {
        expect(e.message).toStrictEqual('Query SELECT 12 UNION SELECT 987 returns more than one row');
      }
    });
  });
});
