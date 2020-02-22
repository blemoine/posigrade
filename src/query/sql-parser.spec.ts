import { sql } from './sql-parser';

describe('sql', () => {
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
});
