import { Sql, SqlConst } from './sql-builder';

describe('SqlBuilder', () => {
  it('should build a simple query', () => {
    const result = Sql`SELECT * FROM users`;

    expect(result.queryText).toStrictEqual('SELECT * FROM users');
    expect(result.values).toStrictEqual([]);
  });

  it('should build a query with parameters', () => {
    const result = Sql`SELECT * FROM users WHERE id = ${1} AND name LIKE ${'%georges%'}`;

    expect(result.queryText).toStrictEqual('SELECT * FROM users WHERE id = $1 AND name LIKE $2');
    expect(result.values).toStrictEqual([1, '%georges%']);
  });

  it('should concat variables when they are SqlQueries', () => {
    const clause = Sql`WHERE id = ${3}`;
    const result = Sql`SELECT *, ${5} FROM bands ${clause} AND name = ${'test'}`;

    expect(result.queryText).toStrictEqual('SELECT *, $1 FROM bands WHERE id = $2 AND name = $3');
    expect(result.values).toStrictEqual([5, 3, 'test']);
  });

  it('should concat variables when they are SqlQueries and they come first', () => {
    const baseQuery = Sql`SELECT * FROM users`;
    const result = Sql`${baseQuery} WHERE id = ${1}`;

    expect(result.queryText).toStrictEqual('SELECT * FROM users WHERE id = $1');
    expect(result.values).toStrictEqual([1]);
  });

  it('should concat variables when they are SqlQueries and they are at the end', () => {
    const baseQuery = Sql`SELECT ${2}, ${3} FROM users`;
    const clause = Sql`WHERE id = ${1}`;
    const result = Sql`${baseQuery} ${clause}`;

    expect(result.queryText).toStrictEqual('SELECT $1, $2 FROM users WHERE id = $3');
    expect(result.values).toStrictEqual([2, 3, 1]);
  });

  it('should be idempotent', () => {
    const baseQuery = Sql`SELECT ${2}, ${3} FROM users`;
    const result = Sql`${baseQuery}`;

    expect(result).toStrictEqual(baseQuery);
    expect(result.queryText).toStrictEqual('SELECT $1, $2 FROM users');
    expect(result.values).toStrictEqual([2, 3]);
  });

  it('should support concatenation with constant', () => {
    const field = SqlConst('id');
    const clause = Sql`WHERE ${field} = ${1}`;

    expect(clause.queryText).toStrictEqual('WHERE id = $1');
    expect(clause.values).toStrictEqual([1]);
  });
});
