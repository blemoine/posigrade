import { Result, sequenceResult } from '../result/Result';
import { NamedDeserializer } from './DeserDefinition';

export type RowObject = { [p: string]: unknown };

export type InferDeserializerType<T> = T extends SqlDeserializer<infer U> ? U : never;

/**
 * Conceptually, a `SqlDeserializer<T>` is a function
 * taking a row coming from the postgres driver,
 * and returning either a T or an Error explaining why we weren't able to get a T
 *
 * Technically, `SqlDeserializer<T>` a wrapper around a function
 *  `(row: RowObject) => Result<T>`
 * with helper methods to help modify this function.
 *
 * When postgres returns rows, we're essentially receiving a `any`.
 * SqlDeserializer goal is to be able to get back a result:
 *  - in a typesafe way
 *  - with clear errors message when there is a problen
 */
export class SqlDeserializer<T> {
  /**
   * Build an object deserializer from an object of deserializers
   * Accept either an SqlDeserializer - and in this case it will use the column specified in the deserializer
   * or a NamedDeserializer - and in this case it will use the key of the object as column name
   *
   *
   * @param records - an object with deserializers values.
   *
   * @example
   *
   * ```
   * const deserializer = SqlDeserializer.fromRecord({
   *   id: deser.toInteger,  // Will use `id` for column name
   *   name: deser.toString.forColumn('another_col'), // will use 'another_col' for column name
   * })
   * ```
   */
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
