import { SqlExecutor } from './sql-executor';
import { Pool } from 'pg';
import { deser } from '../deserializer/deserializers';
import { Sql } from '../query/sql-template-string';

describe('SqlExecutor', () => {
  let pool: Pool;
  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  });
  afterAll(() => {
    pool.end();
  });

  describe('transact', () => {
    it('should commit the transaction at the end', async () => {
      const sqlExecutor = SqlExecutor(pool);
      await sqlExecutor.transact(async (client) => {
        await Sql`CREATE TABLE cookies(id SERIAL PRIMARY KEY, name TEXT NOT NULL);`.update().run(client);
        await Sql`INSERT INTO cookies(name) VALUES ('pocky')`.update().run(client);
      });

      const result = await sqlExecutor.run(Sql`SELECT name FROM cookies`.list(deser.toString.forColumn('name')));

      expect(result).toStrictEqual(['pocky']);
    });
    it('should rollback the transaction if there was an error', async () => {
      const sqlExecutor = SqlExecutor(pool);
      const failedResult = await sqlExecutor
        .transact(async (client) => {
          await Sql`CREATE TABLE brownies(id SERIAL PRIMARY KEY, name TEXT NOT NULL);`.update().run(client);
          await Sql`INSERT INTO brownies(name) VALUES ('chocolate')`.update().run(client);
          throw new Error('Expected error');
        })
        .catch((e) => e);

      expect(failedResult).toStrictEqual(new Error('Expected error'));

      const result = await sqlExecutor
        .run(Sql`SELECT name FROM brownies`.list(deser.toString.forColumn('name')))
        .catch((e) => e);

      expect(result.message).toStrictEqual(
        'Got "relation "brownies" does not exist" on query "SELECT name FROM brownies"'
      );
    });
  });
});
