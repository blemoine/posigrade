import { Failure, Result, Success } from '../result/Result';

export class SqlDeserializer<T> {
  constructor(private _deserialize: (row: unknown[], idx: number) => Result<T>, private currentIdxSize: number) {}

  map<B>(mapper: (t: T) => B): SqlDeserializer<B> {
    const parentDeser = this._deserialize;
    return new SqlDeserializer<B>((row, idx) => {
      return parentDeser(row, idx).map(mapper);
    }, this.currentIdxSize);
  }

  zip<B>(sqlDeserializer: SqlDeserializer<B>): SqlDeserializer<[T, B]> {
    return new SqlDeserializer<[T, B]>((row: unknown[], idx: number): Result<[T, B]> => {
      const v1 = this._deserialize(row, idx);
      const v2 = sqlDeserializer._deserialize(row, idx + this.currentIdxSize);

      return v1.zip(v2);
    }, this.currentIdxSize + 1);
  }

  zipWith<B, C>(sqlDeserializer: SqlDeserializer<B>, cb: (t: T, b: B) => C): SqlDeserializer<C> {
    return this.zip(sqlDeserializer).map(([t, b]) => cb(t, b));
  }

  deserialize(row: unknown[]): Result<T> {
    return this._deserialize(row, 0);
  }
}

const toInteger: SqlDeserializer<number> = new SqlDeserializer<number>((row: unknown[], idx: number): Result<
  number
> => {
  if (row.length < 1) {
    return Failure.raise('There must be at least one row');
  }
  const value = row[idx];
  if (typeof value === 'number' && Number.isInteger(value)) {
    return Success.of(value);
  } else {
    return Failure.raise(`'${value}' is not an integer`);
  }
}, 1);

const toString: SqlDeserializer<string> = new SqlDeserializer<string>((row: unknown[], idx: number): Result<string> => {
  if (row.length < 1) {
    return Failure.raise('There must be at least one row');
  }
  const value = row[idx];
  if (typeof value === 'string') {
    return Success.of(value);
  } else {
    return Failure.raise(`'${value}' is not an string`);
  }
}, 1);

export const deser = {
  toInteger,
  toString,
};

export function sequenceDeser<D, A extends Array<D>>(
  ...arr: A
): SqlDeserializer<{ [K in keyof A]: A[K] extends SqlDeserializer<infer U> ? U : never }> {
  return arr.reduce<SqlDeserializer<Array<unknown>>>((acc, deser) => {
    return acc.zipWith(deser as any, (a, b) => [...a, b]);
  }, new SqlDeserializer(() => Success.of([]), 0)) as any;
}
