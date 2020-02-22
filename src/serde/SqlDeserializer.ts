import { Failure, Result, Success } from '../result/Result';

export class SqlDeserializer<T> {
  constructor(private _deserialize: (row: unknown[], idx: number) => Result<T>) {}

  zip<B>(sqlDeserializer: SqlDeserializer<B>): SqlDeserializer<[T, B]> {
    return new SqlDeserializer<[T, B]>(
      (row: unknown[], idx: number): Result<[T, B]> => {
        const v1 = this._deserialize(row, idx);
        const v2 = sqlDeserializer._deserialize(row, idx + 1);

        return v1.zip(v2);
      }
    );
  }

  deserialize(row: unknown[]): Result<T> {
    return this._deserialize(row, 0);
  }
}

const toInteger: SqlDeserializer<number> = new SqlDeserializer<number>(
  (row: unknown[], idx: number): Result<number> => {
    if (row.length < 1) {
      return Failure.raise('There must be at least one row');
    }
    const value = row[idx];
    if (typeof value === 'number' && Number.isInteger(value)) {
      return Success.of(value);
    } else {
      return Failure.raise(`'${value}' is not an integer`);
    }
  }
);

const toString: SqlDeserializer<string> = new SqlDeserializer<string>(
  (row: unknown[], idx: number): Result<string> => {
    if (row.length < 1) {
      return Failure.raise('There must be at least one row');
    }
    const value = row[idx];
    if (typeof value === 'string') {
      return Success.of(value);
    } else {
      return Failure.raise(`'${value}' is not an string`);
    }
  }
);

export const deser = {
  toInteger,
  toString,
};
