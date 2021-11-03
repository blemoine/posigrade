import { ClientBase, QueryConfig } from 'pg';
import { SqlDeserializer } from '../deserializer/SqlDeserializer';
import { sequenceResult } from '../result/Result';
import { NonEmptyArray } from '../utils/non-empty-array';

export type BaseSupportedValueType = string | number | boolean | Date | null;
export type SupportedValueType = BaseSupportedValueType | Array<BaseSupportedValueType>;

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
}
export class SqlQuery {
  public readonly queryText: string;
  constructor(public readonly strings: NonEmptyArray<string>, public readonly values: SupportedValueType[]) {
    this.queryText = strings.reduce((currText, str, i) => {
      return currText + '$' + i + str;
    });
    this.values = values;
  }

  private getQueryConfig(): QueryConfig {
    return {
      text: this.queryText,
      values: this.values,
    };
  }

  update(): ExecutableQuery<void> {
    return new ExecutableQuery((client) => client.query(this.getQueryConfig()).then(() => {}));
  }

  list<T>(deser: SqlDeserializer<T>): ExecutableQuery<T[]> {
    return new ExecutableQuery(async (client) => {
      const { rows } = await client.query(this.getQueryConfig());

      return sequenceResult(rows.map((row) => deser.deserialize(row))).getOrThrow();
    });
  }

  option<T>(deser: SqlDeserializer<T>): ExecutableQuery<T | null> {
    return new ExecutableQuery(async (client) => {
      const { rows } = await client.query(this.getQueryConfig());
      if (rows.length === 0) {
        return null;
      } else {
        return deser.deserialize(rows[0]).getOrThrow();
      }
    });
  }

  unique<T>(deser: SqlDeserializer<T>): ExecutableQuery<T> {
    return new ExecutableQuery(async (client) => {
      const queryConfig = this.getQueryConfig();
      const { rows } = await client.query(queryConfig);
      if (rows.length === 0) {
        throw new Error(`No row returned for query ${queryConfig.text}`);
      } else {
        return deser.deserialize(rows[0]).getOrThrow();
      }
    });
  }
}
