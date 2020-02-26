import { sql } from './sql-parser';
import { deser } from '../serde/SqlDeserializer';
import { Pool } from 'pg';

describe('sql', () => {
  let pool: Pool;
  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  });
  afterAll(() => {
    pool.end();
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
    const result = await query.list(deser.toString).transact(pool);

    expect(result).toStrictEqual(['Georges']);
  });

  it('should display explicit error message if trying to get a column with the wrong type', async () => {
    const query = sql`SELECT 12`;
    try {
      await query.list(deser.toString).transact(pool);
      fail('This call should fail');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e.message).toStrictEqual("'12' is not an string");
    }
  });
});
