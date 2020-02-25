import { Failure, Result, Success } from '../result/Result';

export interface SqlDeserializer<T, R extends unknown[] | { [key: string]: unknown } = any> {
  map<B>(mapper: (t: T) => B): SqlDeserializer<B, R>;

  zip<B>(sqlDeserializer: SqlDeserializer<B, R>): SqlDeserializer<[T, B], R>;

  or<B>(sqlDeserializer: SqlDeserializer<B, R>): SqlDeserializer<T | B, R>;

  zipWith<B, C>(sqlDeserializer: SqlDeserializer<B, R>, cb: (t: T, b: B) => C): SqlDeserializer<C, R>;

  deserialize(row: R): Result<T>;

  rowMode(): 'array' | 'object';
}

type RowObject = { [p: string]: unknown };

export class NamedSqlDeserializer<T> implements SqlDeserializer<T, RowObject> {
  constructor(private _deserialize: (row: { [key: string]: unknown }) => Result<T>) {}

  deserialize(row: RowObject): Success<T> | Failure<T> {
    return this._deserialize(row);
  }

  map<B>(mapper: (t: T) => B): NamedSqlDeserializer<B> {
    const parentDeser = this._deserialize;
    return new NamedSqlDeserializer((row) => {
      return parentDeser(row).map(mapper);
    });
  }

  or<B>(sqlDeserializer: NamedSqlDeserializer<B>): NamedSqlDeserializer<T | B> {
    return new NamedSqlDeserializer<T | B>(
      (row: RowObject): Result<T | B> => {
        const v1 = this._deserialize(row);

        return v1.recover(() => sqlDeserializer._deserialize(row));
      }
    );
  }

  zip<B>(sqlDeserializer: NamedSqlDeserializer<B>): NamedSqlDeserializer<[T, B]> {
    return new NamedSqlDeserializer<[T, B]>(
      (row: RowObject): Result<[T, B]> => {
        const v1 = this._deserialize(row);
        const v2 = sqlDeserializer._deserialize(row);

        return v1.zip(v2);
      }
    );
  }

  zipWith<B, C>(sqlDeserializer: NamedSqlDeserializer<B>, cb: (t: T, b: B) => C): NamedSqlDeserializer<C> {
    return this.zip(sqlDeserializer).map(([t, b]) => cb(t, b));
  }

  rowMode(): 'object' {
    return 'object';
  }
}

export class PositionSqlDeserializer<T> implements SqlDeserializer<T, unknown[]> {
  constructor(private _deserialize: (row: unknown[], idxOrName: number) => Result<T>, private currentIdxSize: number) {}

  map<B>(mapper: (t: T) => B): PositionSqlDeserializer<B> {
    const parentDeser = this._deserialize;
    return new PositionSqlDeserializer<B>((row, idx) => {
      return parentDeser(row, idx).map(mapper);
    }, this.currentIdxSize);
  }

  zip<B>(sqlDeserializer: PositionSqlDeserializer<B>): PositionSqlDeserializer<[T, B]> {
    return new PositionSqlDeserializer<[T, B]>((row: unknown[], idx: number): Result<[T, B]> => {
      const v1 = this._deserialize(row, idx);
      const v2 = sqlDeserializer._deserialize(row, idx + this.currentIdxSize);

      return v1.zip(v2);
    }, this.currentIdxSize + 1);
  }

  or<B>(sqlDeserializer: PositionSqlDeserializer<B>): PositionSqlDeserializer<T | B> {
    return new PositionSqlDeserializer<T | B>((row: unknown[], idx: number): Result<T | B> => {
      const v1 = this._deserialize(row, idx);

      return v1.recover(() => sqlDeserializer._deserialize(row, idx));
    }, this.currentIdxSize);
  }

  zipWith<B, C>(sqlDeserializer: PositionSqlDeserializer<B>, cb: (t: T, b: B) => C): PositionSqlDeserializer<C> {
    return this.zip(sqlDeserializer).map(([t, b]) => cb(t, b));
  }

  deserialize(row: unknown[]): Result<T> {
    return this._deserialize(row, 0);
  }
  rowMode(): 'array' {
    return 'array';
  }
}

function basicSerializer<A, C extends string | 0>(
  col: C,
  guard: (x: unknown) => x is A,
  errorMessage: (value: unknown) => string
): C extends 0 ? PositionSqlDeserializer<A> : NamedSqlDeserializer<A> {
  if (col === 0) {
    return new PositionSqlDeserializer<A>((row: unknown[], idx: number): Result<A> => {
      if (row.length < 1) {
        return Failure.raise('There must be at least one row');
      }
      const value = row[idx];
      if (guard(value)) {
        return Success.of(value);
      } else {
        return Failure.raise(errorMessage(value));
      }
    }, 1) as C extends 0 ? PositionSqlDeserializer<A> : NamedSqlDeserializer<A>;
  } else {
    return new NamedSqlDeserializer<A>(
      (row: RowObject): Result<A> => {
        const value = row[col];
        if (guard(value)) {
          return Success.of(value);
        } else {
          return Failure.raise(errorMessage(value));
        }
      }
    ) as C extends 0 ? PositionSqlDeserializer<A> : NamedSqlDeserializer<A>;
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const toInteger = <C extends string | 0>(col: C) =>
  basicSerializer<number, C>(
    col,
    (value): value is number => typeof value === 'number' && Number.isInteger(value),
    (value) => `'${value}' is not an integer`
  );

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const toString = <C extends string | 0>(col: C) =>
  basicSerializer<string, C>(
    col,
    (value): value is string => typeof value === 'string',
    (value) => `'${value}' is not an string`
  );

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const toNull = <C extends string | 0>(col: C) =>
  basicSerializer<null, C>(
    col,
    (value): value is null => value === null,
    (value) => `'${value}' is not null`
  );

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const toDate = <C extends string | 0>(col: C) =>
  basicSerializer<Date, C>(
    col,
    (value): value is Date => value instanceof Date,
    (value) => `'${value}' is not a Date`
  );

export const deser = {
  toInteger: toInteger(0),
  toString: toString(0),
  toDate: toDate(0),
  toNull: toNull(0),
};

export const namedDeser = {
  toInteger,
  toString,
  toDate,
  toNull,
};

export function sequenceDeser<D, A extends Array<D>>(
  ...arr: A
): PositionSqlDeserializer<{ [K in keyof A]: A[K] extends PositionSqlDeserializer<infer U> ? U : never }> {
  return arr.reduce<PositionSqlDeserializer<Array<unknown>>>((acc, deser) => {
    return acc.zipWith(deser as any, (a, b) => [...a, b]);
  }, new PositionSqlDeserializer(() => Success.of([]), 0)) as PositionSqlDeserializer<
    { [K in keyof A]: A[K] extends PositionSqlDeserializer<infer U> ? U : never }
  >;
}

export function sequenceDeserRecord<A extends { [key: string]: any }>(
  obj: A
): NamedSqlDeserializer<{ [K in keyof A]: A[K] extends NamedSqlDeserializer<infer U> ? U : never }> {
  return Object.entries(obj).reduce<NamedSqlDeserializer<{ [key: string]: unknown }>>((acc, [key, deser]) => {
    return acc.zipWith(deser, (a, b) => ({ ...a, [key]: b }));
  }, new NamedSqlDeserializer(() => Success.of({}))) as NamedSqlDeserializer<
    { [K in keyof A]: A[K] extends NamedSqlDeserializer<infer U> ? U : never }
  >;
}
