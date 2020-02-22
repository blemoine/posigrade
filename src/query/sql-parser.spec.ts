import { sql } from './sql-parser';
import { deser } from '../serde/SqlDeserializer';
import { Client } from 'pg';

describe('sql', () => {
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
  it('should parse a SQL query without parameters', () => {
    const result = sql`SELECT COUNT(*) FROM users`;
    expect(result.queryConfig.text).toStrictEqual('SELECT COUNT(*) FROM users');
    expect(result.queryConfig.values).toStrictEqual([]);
  });
  it('should parse a SQL query with one parameter', () => {
    const firstName = 'Ginette';
    const result = sql`SELECT id FROM users WHERE first_name = ${firstName}`;
    expect(result.queryConfig.text).toStrictEqual('SELECT id FROM users WHERE first_name = $1');
    expect(result.queryConfig.values).toStrictEqual([firstName]);
  });
  it('should parse a SQL query with multiple parameters', () => {
    const firstName = 'Ginette';
    const result = sql`SELECT id, age FROM users WHERE first_name = ${firstName} AND age > ${12} AND id IS NOT NULL`;

    expect(result.queryConfig.text).toStrictEqual(
      'SELECT id, age FROM users WHERE first_name = $1 AND age > $2 AND id IS NOT NULL'
    );
    expect(result.queryConfig.values).toStrictEqual([firstName, 12]);
  });

  it('should interpret correctly variables when using string templates', async () => {
    const name = 'Georges';

    const query = sql`SELECT ${name}`;
    const result = await query.list(deser.toString).run(client);

    expect(result).toStrictEqual(['Georges']);
  });
});
