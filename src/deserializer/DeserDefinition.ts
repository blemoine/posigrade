import { SqlDeserializer } from './SqlDeserializer';
import { Failure, Result, Success } from '../result/Result';
import { NonEmptyArray } from '../utils/non-empty-array';

/**
 * Conceptually, a NamedDeserializer<T> is function
 * taking a column name as input a returning an SqlDeserializer<T> for this column.
 * It's useful because most of the time `SqlDeserializer`s are reusable for different columns,
 * but sharing a common type.
 *
 * Technically, a `NamedDeserializer<T>` is a wrapper around `(col: string) => SqlDeserializer<T>`
 *
 * Most of the time, we don't need to build one manually, and we can use `toNamedDeserializer` function instead
 * if we need to build one
 *
 * @example
 *
 * ```
 * const postiveNumber: DeserDefinition<number> =  {
 *     guard: (x:unknown): x is number => typeof x === 'number' && x > 0,
 *     errorMessage: (x: unknwon) => `${x} should be a positive number`
 * }
 * const positiveNumberDeserializer = toNamedDeserializer(positiveNumber);
 *
 *
 * // we can now use positiveNumberDeserializer for different column
 * positiveNumberDeserializer('price'); // SqlDeserializer for price column
 * positiveNumberDeserializer('tax'); // SqlDeserializer for tax column
 *
 * ```
 */
export class NamedDeserializer<T> {
  constructor(public forColumn: (col: string) => SqlDeserializer<T>) {}
  map<U>(fn: (t: T) => U): NamedDeserializer<U> {
    return new NamedDeserializer<U>((col) => this.forColumn(col).map(fn));
  }
  mapFailure(
    mapper: (colName: string, messages: NonEmptyArray<string>) => NonEmptyArray<string>
  ): NamedDeserializer<T> {
    return new NamedDeserializer<T>((col) => this.forColumn(col).mapFailure((messages) => mapper(col, messages)));
  }
  transform<B>(mapper: (t: T) => Result<B>): NamedDeserializer<B> {
    return new NamedDeserializer((col) => {
      return this.forColumn(col).transform(mapper);
    });
  }
  chain<B>(mapper: (t: T) => NamedDeserializer<B>): NamedDeserializer<B> {
    return new NamedDeserializer((col) => {
      return this.forColumn(col).chain((t) => mapper(t).forColumn(col));
    });
  }
  or<U>(other: NamedDeserializer<U>): NamedDeserializer<T | U> {
    return new NamedDeserializer<T | U>((col) => this.forColumn(col).or(other.forColumn(col)));
  }
  orNull(): NamedDeserializer<T | null> {
    return this.or(NullDeserializer);
  }
}

export type DeserDefinition<A> = {
  guard: (x: unknown) => x is A;
  errorMessage: (value: unknown) => string;
};

export function toNamedDeserializer<T>({ guard, errorMessage }: DeserDefinition<T>): NamedDeserializer<T> {
  return new NamedDeserializer(
    (col: string) =>
      new SqlDeserializer<T>((row) => {
        if (!Object.prototype.hasOwnProperty.call(row, col)) {
          return Failure.raise(`No column named '${col}' exists in the list of cols '${Object.keys(row).join(', ')}'`);
        }
        const value = row[col];
        if (guard(value)) {
          return Success.of(value);
        } else {
          return Failure.raise(`Column '${col}': ${errorMessage(value)}`);
        }
      })
  );
}

const toNullDef: DeserDefinition<null> = {
  guard: (value): value is null => value === null,
  errorMessage: (value) => `'${value}' is not null`,
};
export const NullDeserializer = toNamedDeserializer(toNullDef);
