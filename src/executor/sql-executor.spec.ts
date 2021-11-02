import { SqlExecutor } from './sql-executor';
import { Pool } from 'pg';
import { named } from '../deserializer/deserializers';

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
      await SqlExecutor(pool).transact(async (Sql) => {
        await Sql`CREATE TABLE cookies(id SERIAL PRIMARY KEY, name TEXT NOT NULL);`.update();
        await Sql`INSERT INTO cookies(name) VALUES ('pocky')`.update();
      });

      const result = await SqlExecutor(pool).run((Sql) => Sql`SELECT name FROM cookies`.list(named.toString('name')));

      expect(result).toStrictEqual(['pocky']);
    });
    it('should rollback the transaction if there was an error', async () => {
      const failedResult = await SqlExecutor(pool)
        .transact(async (Sql) => {
          await Sql`CREATE TABLE brownies(id SERIAL PRIMARY KEY, name TEXT NOT NULL);`.update();
          await Sql`INSERT INTO brownies(name) VALUES ('chocolate')`.update();
          throw new Error('Expected error');
        })
        .catch((e) => e);

      expect(failedResult).toStrictEqual(new Error('Expected error'));

      const result = await SqlExecutor(pool)
        .run((Sql) => Sql`SELECT name FROM brownies`.list(named.toString('chocolate')))
        .catch((e) => e);

      expect(result.message).toStrictEqual(`relation "brownies" does not exist`);
    });
  });
});
