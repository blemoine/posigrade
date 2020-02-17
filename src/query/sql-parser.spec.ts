import { sql } from './sql-parser';

describe('sql', () => {
  it('should parse a SQL query without parameters', () => {
    const result = sql`SELECT COUNT(*) FROM users`;
    expect(result).toStrictEqual({ text: 'SELECT COUNT(*) FROM users', values: [] });
  });
  it('should parse a SQL query with one parameter', () => {
    const firstName = 'Ginette';
    const result = sql`SELECT id FROM users WHERE first_name = ${firstName}`;
    expect(result).toStrictEqual({ text: 'SELECT id FROM users WHERE first_name = $1', values: [firstName] });
  });
  it('should parse a SQL query with multiple parameters', () => {
    const firstName = 'Ginette';
    const result = sql`SELECT id, age FROM users WHERE first_name = ${firstName} AND age > ${12} AND id IS NOT NULL`;
    expect(result).toStrictEqual({
      text: 'SELECT id, age FROM users WHERE first_name = $1 AND age > $2 AND id IS NOT NULL',
      values: [firstName, 12],
    });
  });
});
