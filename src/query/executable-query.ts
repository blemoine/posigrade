import { ClientBase } from 'pg';

export type QueryableClient = { query: ClientBase['query'] };
export class ExecutableQuery<T> {
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
