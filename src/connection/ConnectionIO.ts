import { ClientBase, Pool } from 'pg';

export class ConnectionIO<A> {
  constructor(private run: (client: ClientBase) => Promise<A>) {}

  map<B>(mapper: (a: A) => B): ConnectionIO<B> {
    const parentRun = this.run;
    return new ConnectionIO<B>((client) => parentRun(client).then(mapper));
  }

  flatMap<B>(mapper: (a: A) => ConnectionIO<B>): ConnectionIO<B> {
    const parentRun = this.run;
    return new ConnectionIO<B>((client) => parentRun(client).then((a) => mapper(a).run(client)));
  }

  zip<B>(connectionIo: ConnectionIO<B>): ConnectionIO<readonly [A, B]> {
    const parentRun = this.run;
    return new ConnectionIO<readonly [A, B]>((client) => {
      return Promise.all([parentRun(client), connectionIo.run(client)]);
    });
  }

  async transact(pool: Pool): Promise<A> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await this.run(client);

      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
