import { ClientBase, Pool } from 'pg';
import { Unshift } from '../utils/Tuple.type';

export class ConnectionIO<A> {
  static of<A>(a: A): ConnectionIO<A> {
    return new ConnectionIO<A>(() => Promise.resolve(a));
  }
  static empty: ConnectionIO<void> = new ConnectionIO<void>(() => Promise.resolve());
  constructor(private run: (client: ClientBase) => Promise<A>) {}

  map<B>(mapper: (a: A) => B): ConnectionIO<B> {
    const parentRun = this.run;
    return new ConnectionIO<B>((client) => parentRun(client).then(mapper));
  }

  chain<B>(mapper: (a: A) => ConnectionIO<B>): ConnectionIO<B> {
    return this.flatMap(mapper);
  }
  flatMap<B>(mapper: (a: A) => ConnectionIO<B>): ConnectionIO<B> {
    const parentRun = this.run;
    return new ConnectionIO<B>((client) => parentRun(client).then((a) => mapper(a).run(client)));
  }

  zip<T extends Array<any>>(...connectionIos: { [K in keyof T]: ConnectionIO<T[K]> }): ConnectionIO<Unshift<T, A>> {
    const parentRun = this.run;
    return new ConnectionIO((client) => {
      return Promise.all([parentRun(client), ...connectionIos.map((c) => c.run(client))]);
    }) as any;
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
