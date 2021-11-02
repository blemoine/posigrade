import { Pool } from 'pg';
import { SqlBuilder, SqlTemplateString } from '../query/sql-builder';

export const SqlExecutor = (pool: Pool) => {
  return {
    async transact<T>(fn: (Sql: SqlTemplateString) => Promise<T>): Promise<T> {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const result = await fn(SqlBuilder(client));

        await client.query('COMMIT');

        return result;
      } catch (e) {
        await client.query('ROLLBACK');

        throw e;
      } finally {
        client.release();
      }
    },

    async run<T>(fn: (Sql: SqlTemplateString) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        const result = await fn(SqlBuilder(client));
        return result;
      } finally {
        client.release();
      }
    },
  };
};
