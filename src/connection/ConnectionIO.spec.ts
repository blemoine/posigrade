import { Pool } from 'pg';
import { ConnectionIO } from './ConnectionIO';

describe('ConnectionIO', () => {
  let pool: Pool;
  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  });
  afterAll(() => {
    pool.end();
  });
  test('should form a monad', async () => {
    const c1 = new ConnectionIO((client) => client.query('SELECT 45 as n')).map(({ rows }) => rows[0].n);
    const c2 = c1.flatMap((x) =>
      new ConnectionIO((client) => client.query('SELECT 36 as n')).map(({ rows }) => rows[0].n + x)
    );

    const result = await c2.transact(pool);

    expect(result).toBe(81);
  });
});
