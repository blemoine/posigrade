import { Pool } from 'pg';
import { ExecutableQuery, QueryableClient } from '../query/executable-query';

export type SqlExecutor = ReturnType<typeof SqlExecutor>;
/**
 * The main goal the `SqlExecutor` function is to simplify the execution of `ExecutableQuery`
 * as a single run _or_ in a transaction.
 *
 *
 * @param pool - the connection pool to use to create the client. cf https://node-postgres.com/features/connecting
 *
 * @example
 *
 * ```
 * const sqlExecutor = SqlExecutor(pool);
 *
 * // Direct execution
 * const result = sqlExecutor.run(SQL`SELECT id FROM my_tables`.list(deser.toInteger.forColumn('id')));
 *
 * // Using the client
 * const result = sqlExecutor.transact(client => {
 *  SQL`SELECT id FROM my_tables`.list(deser.toInteger.forColumn('id'))).run(client);
 * });
 * ```
 */
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

  close(): Promise<void> {
    return pool.end();
  },
});
