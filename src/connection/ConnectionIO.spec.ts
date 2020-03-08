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
  describe('should form a monad', () => {
    test('should have a pure operation', async () => {
      const c1 = ConnectionIO.of(12);

      const result = await c1.transact(pool);

      expect(result).toBe(12);
    });
    test('should have a flatMap operation', async () => {
      const c1 = new ConnectionIO((client) => client.query('SELECT 45 as n')).map(({ rows }) => rows[0].n);
      const c2 = c1.flatMap((x) =>
        new ConnectionIO((client) => client.query('SELECT 36 as n')).map(({ rows }) => rows[0].n + x)
      );

      const result = await c2.transact(pool);

      expect(result).toBe(81);
    });
  });

  test('should support parallel execution with zip', (done) => {
    let resolve!: () => void;
    const promise = new Promise((r) => (resolve = r));
    const c1 = new ConnectionIO(() => promise);
    const callback = jest.fn(() => Promise.resolve(12));
    const c2 = new ConnectionIO(callback);
    const c3: ConnectionIO<[unknown, number]> = c1.zip(c2);

    expect(callback).not.toHaveBeenCalled();

    c3.transact(pool);
    setTimeout(() => {
      expect(callback).toHaveBeenCalledTimes(1);
      resolve();
      done();
    }, 100);
  });

  test('zip should be able to take multiple connectionIO as parameter', async () => {
    const c1 = new ConnectionIO(() => Promise.resolve(1));
    const c2 = new ConnectionIO(() => Promise.resolve(2));
    const c3 = new ConnectionIO(() => Promise.resolve(3));

    const result: ConnectionIO<[number, number, number]> = c1.zip(c2, c3);

    const values = await result.transact(pool);

    expect(values).toStrictEqual([1, 2, 3]);
  });

  describe('ConnectionIO.sequence', () => {
    test('it should return an empty array if the input array is empty', async () => {
      const arr = ConnectionIO.sequence([]);

      const result = await arr.transact(pool);

      expect(result).toStrictEqual([]);
    });

    test('it should return all the connections wrapped', async () => {
      const arr = ConnectionIO.sequence([ConnectionIO.of(1), ConnectionIO.of(2), ConnectionIO.of(3)] as const);

      const result = await arr.transact(pool);

      expect(result).toStrictEqual([1, 2, 3]);
    });
  });
});
