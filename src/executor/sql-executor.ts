import { Pool } from 'pg';
import { ExecutableQuery, QueryableClient } from '../query/executable-query';

export type SqlExecutor = ReturnType<typeof SqlExecutor>;
export const SqlExecutor = (pool: Pool) => ({
  async transact<T>(fn: ExecutableQuery<T> | ((client: QueryableClient) => Promise<T>)): Promise<T> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await (fn instanceof ExecutableQuery ? fn.run(client) : fn(client));

      await client.query('COMMIT');

      return result;
    } catch (e) {
      await client.query('ROLLBACK');

      throw e;
    } finally {
      client.release();
    }
  },

  async run<T>(fn: ExecutableQuery<T> | ((client: QueryableClient) => Promise<T>)): Promise<T> {
    const client = await pool.connect();
    try {
      const result = await (fn instanceof ExecutableQuery ? fn.run(client) : fn(client));
      return result;
    } finally {
      client.release();
    }
  },
});
