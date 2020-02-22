import { Client } from 'pg';
import { ConnectionIO } from './ConnectionIO';

describe('ConnectionIO', () => {
  let client: Client;
  beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
  });
  afterAll(() => {
    client.end();
  });
  test('should form a monad', async () => {
    const c1 = new ConnectionIO((client) => client.query('SELECT 45 as n')).map(({ rows }) => rows[0].n);
    const c2 = c1.flatMap((x) =>
      new ConnectionIO((client) => client.query('SELECT 36 as n')).map(({ rows }) => rows[0].n + x)
    );

    const result = await c2.run(client);

    expect(result).toBe(81);
  });
});
