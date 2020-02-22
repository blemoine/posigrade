import { Failure, Result, Success } from '../result/Result';

export type SqlDeserializer<T> = {
  deserialize(row: unknown[]): Result<T>;
};

const toInteger: SqlDeserializer<number> = {
  deserialize(row: unknown[]): Result<number> {
    if (row.length < 1) {
      return Failure.raise('There must be at least one row');
    }
    const value = row[0];
    if (typeof value === 'number' && Number.isInteger(value)) {
      return Success.of(value);
    } else {
      return Failure.raise(`'${value}' is not an integer`);
    }
  },
};

export const deser = {
  toInteger,
};
