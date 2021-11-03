import { Result, sequenceResult } from '../result/Result';
import { NamedDeserializer } from './DeserDefinition';

export type RowObject = { [p: string]: unknown };

export type InferDeserializerType<T> = T extends SqlDeserializer<infer U> ? U : never;
export class SqlDeserializer<T> {
  static fromRecord<O extends Record<string, unknown>>(records: {
    [name in keyof O]: SqlDeserializer<O[name]> | NamedDeserializer<O[name]>;
  }): SqlDeserializer<O> {
    return new SqlDeserializer<O>((row) => {
      const results = Object.entries(records).map(
        ([name, rawDeser]: [string, SqlDeserializer<unknown> | NamedDeserializer<unknown>]) => {
          const deser = rawDeser instanceof NamedDeserializer ? rawDeser.forColumn(name) : rawDeser;
          return deser.deserialize(row).map((v) => [name, v] as const);
        }
      );
      const result = sequenceResult(results);

      return result.map(Object.fromEntries);
    });
  }

  constructor(public readonly deserialize: (row: RowObject) => Result<T>) {}

  map<U>(fn: (t: T) => U): SqlDeserializer<U> {
    return new SqlDeserializer<U>((row) => this.deserialize(row).map(fn));
  }

  transform<B>(mapper: (t: T) => Result<B>): SqlDeserializer<B> {
    return new SqlDeserializer((row) => {
      return this.deserialize(row).chain(mapper);
    });
  }

  or<B>(sqlDeserializer: SqlDeserializer<B>): SqlDeserializer<T | B> {
    return new SqlDeserializer<T | B>((row): Result<T | B> => {
      const v1 = this.deserialize(row);

      return v1.recover(() => sqlDeserializer.deserialize(row));
    });
  }
}
