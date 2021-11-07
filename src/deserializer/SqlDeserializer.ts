import { Result, sequenceResult, Success } from '../result/Result';
import { NamedDeserializer } from './DeserDefinition';

export type RowObject = { [p: string]: unknown };

/**
 * This type is used to infer the type defined by a serializer.
 *
 * @example
 *
 * You can either:
 * define your domain type yourself, and create a deserializer for it, but you will have some duplication:
 *
 * ```
 * type User = {id:number, name:string};
 * const userDeserializer = SqlDeserializer.fromRecord<User>({
 *   id: deser.toInteger,
 *   name: deser.toString,
 * })
 * ```
 *
 * or you can define the deserializer an infer from the type from there:
 *
 * ```
 * const userDeserializer = SqlDeserializer.fromRecord({
 *   id: deser.toInteger,
 *   name: deser.toString,
 * })
 *
 * type User = InferDeserializerType<typeof userDeserializer>;
 * // will hold {id:number, name:string}
 * ```
 */
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
  static fromRecord<O extends object>(records: {
    [name in keyof O]: SqlDeserializer<O[name]> | NamedDeserializer<O[name]>;
  }): SqlDeserializer<O> {
    return new SqlDeserializer<O>((row) => {
      const entries = Object.entries(records) as [string, SqlDeserializer<unknown> | NamedDeserializer<unknown>][];
      const results = entries.map(([name, rawDeser]) => {
        const deser = rawDeser instanceof NamedDeserializer ? rawDeser.forColumn(name) : rawDeser;
        return deser.deserialize(row).map((v) => [name, v] as const);
      });
      const result = sequenceResult(results);

      return result.map(Object.fromEntries);
    });
  }

  static fromTuple<O extends readonly unknown[]>(tuple: { [I in keyof O]: SqlDeserializer<O[I]> }): SqlDeserializer<O> {
    return new SqlDeserializer<O>((row) => {
      const results = tuple.map((deser) => deser.deserialize(row));
      return sequenceResult(results) as Result<O>;
    });
  }

  static of<U>(u: U): SqlDeserializer<U> {
    return new SqlDeserializer(() => Success.of(u));
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

  chain<B>(mapper: (t: T) => SqlDeserializer<B>): SqlDeserializer<B> {
    return new SqlDeserializer((row) => {
      return this.deserialize(row).chain((t) => mapper(t).deserialize(row));
    });
  }

  or<B>(sqlDeserializer: SqlDeserializer<B>): SqlDeserializer<T | B> {
    return new SqlDeserializer<T | B>((row): Result<T | B> => {
      const v1 = this.deserialize(row);

      return v1.recover(() => sqlDeserializer.deserialize(row));
    });
  }
}
