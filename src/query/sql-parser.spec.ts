import { sql, sqlFrag } from './sql-parser';
import { deser, namedDeser } from '../serde/SqlDeserializer';
import { Pool } from 'pg';
import { SqlQuery } from './sql-query';

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
      expect(e.message).toStrictEqual("Column '0': '12' is not a string");
    }
  });

  it('should display explicit error message if trying to get by position a column that does not exist ', async () => {
    const query = sql`SELECT '12'`;
    try {
      await query.list(deser.toString.zip(deser.toInteger)).transact(pool);
      fail('This call should fail');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e.message).toStrictEqual('There must be at least 1 values in a row');
    }
  });

  it('should combine errors message', async () => {
    const query = sql`SELECT 'test', 12`;
    try {
      await query.list(deser.toDate.zip(deser.toString)).transact(pool);
      fail('This call should fail');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e.message).toStrictEqual("Column '0': 'test' is not a Date, Column '1': '12' is not a string");
    }
  });

  it('should display explicit error message if trying to get by name a column with the wrong type', async () => {
    const query = sql`SELECT 12 as id`;
    try {
      await query.list(namedDeser.toString('id')).transact(pool);
      fail('This call should fail');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e.message).toStrictEqual("Column 'id': '12' is not a string");
    }
  });
  it('should display explicit error message if trying to get by name a column that does not exist', async () => {
    const query = sql`SELECT 12 as id`;
    try {
      await query.list(namedDeser.toString('name')).transact(pool);
      fail('This call should fail');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e.message).toStrictEqual("No column named 'name' exists in the list of cols 'id'");
    }
  });
});

describe('sqlFrag', () => {
  it('should create a sqlFragment, transformable to a query', () => {
    const value = 12;
    const fr = sqlFrag`SELECT ${value} as id`;

    const query = fr.toQuery();

    expect(query).toStrictEqual(
      new SqlQuery({
        text: 'SELECT $1 as id',
        values: [12],
      })
    );
  });

  it('should support sqlFragment concatenation', () => {
    const value = 12;
    const table = 'cars';
    const id = 23;
    const name = 'tesla';
    const fr1 = sqlFrag`SELECT ${value}`;
    const fr2 = sqlFrag` FROM ${table} WHERE id =`;
    const fr3 = sqlFrag`${id} AND name=`;
    const fr4 = sqlFrag`${name}`;

    const query = fr1
      .concat(fr2)
      .concat(fr3)
      .concat(fr4)
      .toQuery();

    expect(query).toStrictEqual(
      new SqlQuery({
        text: 'SELECT $1 FROM $2 WHERE id =$3 AND name=$4',
        values: [12, 'cars', 23, name],
      })
    );
  });
});
