import { Failure, Result, Success } from '../result/Result';

export type SqlDeserializer<T> = NamedSqlDeserializer<T> | PositionSqlDeserializer<T>;

type RowObject = { [p: string]: unknown };

export class NamedSqlDeserializer<T> {
  rowMode: 'object' = 'object';
  constructor(private _deserialize: (row: RowObject) => Result<T>) {}

  deserialize(row: RowObject): Result<T> {
    return this._deserialize(row);
  }

  transform<B>(mapper: (t: T) => Result<B>): NamedSqlDeserializer<B> {
    const parentDeser = this._deserialize;
    return new NamedSqlDeserializer((row) => {
      return parentDeser(row).flatMap(mapper);
    });
  }

  map<B>(mapper: (t: T) => B): NamedSqlDeserializer<B> {
    const parentDeser = this._deserialize;
    return new NamedSqlDeserializer((row) => {
      return parentDeser(row).map(mapper);
    });
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
}

export class PositionSqlDeserializer<T> {
  rowMode: 'array' = 'array';
  constructor(private _deserialize: (row: unknown[], idxOrName: number) => Result<T>, private currentIdxSize: number) {}

  map<B>(mapper: (t: T) => B): PositionSqlDeserializer<B> {
    const parentDeser = this._deserialize;
    return new PositionSqlDeserializer<B>((row, idx) => {
      return parentDeser(row, idx).map(mapper);
    }, this.currentIdxSize);
  }

  transform<B>(mapper: (t: T) => Result<B>): PositionSqlDeserializer<B> {
    const parentDeser = this._deserialize;
    return new PositionSqlDeserializer<B>((row, idx) => {
      return parentDeser(row, idx).flatMap(mapper);
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
}

type DeserDefinition<A> = {
  guard: (x: unknown) => x is A;
  errorMessage: (value: unknown) => string;
};

const toInteger: DeserDefinition<number> = {
  guard: (value): value is number => typeof value === 'number' && Number.isInteger(value),
  errorMessage: (value) => `'${value}' is not an integer`,
};
const toString: DeserDefinition<string> = {
  guard: (value): value is string => typeof value === 'string',
  errorMessage: (value) => `'${value}' is not an string`,
};

const toNull: DeserDefinition<null> = {
  guard: (value): value is null => value === null,
  errorMessage: (value) => `'${value}' is not null`,
};
const toDate: DeserDefinition<Date> = {
  guard: (value): value is Date => value instanceof Date,
  errorMessage: (value) => `'${value}' is not a Date`,
};

const basicNamedSerializer = <A>({ guard, errorMessage }: DeserDefinition<A>) => (
  col: string
): NamedSqlDeserializer<A> => {
  return new NamedSqlDeserializer<A>(
    (row: RowObject): Result<A> => {
      if (!Object.prototype.hasOwnProperty.call(row, col)) {
        throw new Error(`No column named '${col}' exists in the list of cols '${Object.keys(row).join(', ')}'`);
      }
      const value = row[col];
      if (guard(value)) {
        return Success.of(value);
      } else {
        return Failure.raise(`Column '${col}': ${errorMessage(value)}`);
      }
    }
  );
};

function basicPositionSerializer<A>({ guard, errorMessage }: DeserDefinition<A>): PositionSqlDeserializer<A> {
  return new PositionSqlDeserializer<A>((row: unknown[], idx: number): Result<A> => {
    if (row.length <= idx) {
      return Failure.raise(`There must be at least ${idx} values in a row`);
    }

    const value = row[idx];
    if (guard(value)) {
      return Success.of(value);
    } else {
      return Failure.raise(`Column '${idx}': ` + errorMessage(value));
    }
  }, 1);
}

const strToBigInt = (s: string): Result<BigInt> => {
  try {
    return Success.of(BigInt(s));
  } catch (e) {
    return Failure.raise(`Cannot convert '${s}' to BigInt`);
  }
};

export const deser = {
  toBigInt: basicPositionSerializer(toString).transform(strToBigInt),
  toInteger: basicPositionSerializer(toInteger),
  toString: basicPositionSerializer(toString),
  toDate: basicPositionSerializer(toDate),
  toNull: basicPositionSerializer(toNull),
} as const;

export const namedDeser = {
  toBigInt: (col: string) => basicNamedSerializer(toString)(col).transform(strToBigInt),
  toInteger: basicNamedSerializer(toInteger),
  toString: basicNamedSerializer(toString),
  toDate: basicNamedSerializer(toDate),
  toNull: basicNamedSerializer(toNull),
} as const;

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
