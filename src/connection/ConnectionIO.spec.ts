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

  test('should support parallel execution with zip', (done) => {
    let resolve!: () => void;
    const promise = new Promise((r) => (resolve = r));
    const c1 = new ConnectionIO(() => promise);
    const callback = jest.fn(() => Promise.resolve(12));
    const c2 = new ConnectionIO(callback);
    const c3 = c1.zip(c2);

    expect(callback).not.toHaveBeenCalled();

    c3.transact(pool);
    setTimeout(() => {
      expect(callback).toHaveBeenCalledTimes(1);
      resolve();
      done();
    }, 100);
  });
});
