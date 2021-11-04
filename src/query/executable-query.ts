import { ClientBase } from 'pg';

/**
 * ClientBase may be a pain to fake for test, and we only use `query` anyway,
 * so it was easier to just expect something with the method `query` here.
 *
 * ClientBase being a subtype of QueryableClient, it's always possible to
 * pass a ClientBase
 *
 */
export type QueryableClient = { query: ClientBase['query'] };

/**
 * An `ExecutableQuery<T>` is conceptually a wrapper around `(client: ClientBase) => Promise<T>`, ie. something that
 * given a postgres client, will return a Promise of `T`.
 *
 * Most of the time, `ExecutableQuery` will be built from a `SqlQuery` and
 * you will only have to call `run` method on this type to get back the `Promise<T>`
 *
 * @example
 *
 * ```
 * const name = '123';
 * const query: SqlQuery = SQL`SELECT id, name FROM users WHERE name = ${name}`;
 *
 * const deserializer = SqlDeserializer.fromRecord({
 *   id: deser.toInteger,  // Will use `id` for column name
 *   name: deser.toString.forColumn('another_col'), // will use 'another_col' for column name
 * });
 * type User = InferDeserializerType<typeof deserializer>;
 *
 * const executableQuery: ExecutableQuery<User[]> = query.list(deser);
 * const result = executableQuery.run(client) // client comes from an SqlExecutor
 * //Result is a Promise<User[]>
 *
 * ```
 *
 */
export class ExecutableQuery<T> {
  /**
   * This build an ExecutableQuery than will always return the parameter passed, whatever the client.
   * It's mostly useful for tests.
   *
   * @param u - the value that will always be returned by the ExecutableQuery
   *
   * @example
   *
   * ```
   * const executableQuery = ExecutableQuery.of(2);
   *
   * await executableQuery.run({} as any) // return 2
   * ```
   */
  static of<U>(u: U): ExecutableQuery<U> {
    return new ExecutableQuery<U>(() => Promise.resolve(u));
  }
  constructor(public run: (client: QueryableClient) => Promise<T>) {}
  map<U>(fn: (t: T) => U): ExecutableQuery<U> {
    return new ExecutableQuery<U>((client) => this.run(client).then(fn));
  }
  andThen<U>(eq: ExecutableQuery<U>): ExecutableQuery<U> {
    return new ExecutableQuery<U>((client) => this.run(client).then(() => eq.run(client)));
  }
  chain<U>(fn: (t: T) => ExecutableQuery<U>): ExecutableQuery<U> {
    return new ExecutableQuery<U>((client) => this.run(client).then((t) => fn(t).run(client)));
  }
}
