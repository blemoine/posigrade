import { Failure, Result, Success } from '../result/Result';

export type SqlDeserializer<T> = NamedSqlDeserializer<T> | PositionSqlDeserializer<T>;

type RowObject = { [p: string]: unknown };

export class NamedSqlDeserializer<T> {
  rowMode: 'object' = 'object';
  static sequenceDeserRecord<A extends { [key: string]: any }>(
    obj: {
      [K in keyof A]: NamedSqlDeserializer<A[K]> | ((col: string) => NamedSqlDeserializer<A[K]>);
    }
  ): NamedSqlDeserializer<A> {
    return Object.entries(obj).reduce<NamedSqlDeserializer<Partial<A>>>((acc, [key, baseDeser]) => {
      const deser: NamedSqlDeserializer<unknown> = typeof baseDeser === 'function' ? baseDeser(key) : baseDeser;
      return acc.zipWith(deser, (a, b) => ({ ...a, [key]: b }));
    }, new NamedSqlDeserializer(() => Success.of({}))) as NamedSqlDeserializer<A>;
  }
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

  or<B>(sqlDeserializer: NamedSqlDeserializer<B>): NamedSqlDeserializer<T | B> {
    return new NamedSqlDeserializer<T | B>(
      (row: RowObject): Result<T | B> => {
        const v1 = this._deserialize(row);

        return v1.recover(() => sqlDeserializer._deserialize(row));
      }
    );
  }
}

export class PositionSqlDeserializer<T> {
  rowMode: 'array' = 'array';

  static sequenceDeser<A extends Array<any>>(
    ...arr: { [K in keyof A]: PositionSqlDeserializer<A[K]> }
  ): PositionSqlDeserializer<A> {
    return arr.reduce<PositionSqlDeserializer<Array<unknown>>>((acc, deser) => {
      return acc.zipWith(deser as any, (a, b) => [...a, b]);
    }, new PositionSqlDeserializer(() => Success.of([]), 0)) as PositionSqlDeserializer<A>;
  }

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

const toNumber: DeserDefinition<number> = {
  guard: (value): value is number => typeof value === 'number',
  errorMessage: (value) => `'${value}' is not a number`,
};
const toInteger: DeserDefinition<number> = {
  guard: (value): value is number => typeof value === 'number' && Number.isInteger(value),
  errorMessage: (value) => `'${value}' is not an integer`,
};
const toString: DeserDefinition<string> = {
  guard: (value): value is string => typeof value === 'string',
  errorMessage: (value) => `'${value}' is not a string`,
};

const toNull: DeserDefinition<null> = {
  guard: (value): value is null => value === null,
  errorMessage: (value) => `'${value}' is not null`,
};
const toDate: DeserDefinition<Date> = {
  guard: (value): value is Date => value instanceof Date,
  errorMessage: (value) => `'${value}' is not a Date`,
};

type BasicNamedSqlDeserializer<A> = NamedSqlDeserializer<A> & { orNull(): NamedSqlDeserializer<A | null> };
const basicNamedDeserializer = <A>({ guard, errorMessage }: DeserDefinition<A>) => (
  col: string
): BasicNamedSqlDeserializer<A> => {
  const deserialize = (row: RowObject): Result<A> => {
    if (!Object.prototype.hasOwnProperty.call(row, col)) {
      throw new Error(`No column named '${col}' exists in the list of cols '${Object.keys(row).join(', ')}'`);
    }
    const value = row[col];
    if (guard(value)) {
      return Success.of(value);
    } else {
      return Failure.raise(`Column '${col}': ${errorMessage(value)}`);
    }
  };
  return new (class extends NamedSqlDeserializer<A> {
    constructor() {
      super(deserialize);
    }

    orNull(): NamedSqlDeserializer<A | null> {
      return new NamedSqlDeserializer<A | null>(
        (row: RowObject): Result<A | null> => {
          return deserialize(row).recover((messages) => {
            if (row[col] === null) {
              return Success.of(null);
            } else {
              return new Failure([...messages, `Column '${col}': '${row[col]}' is not null`]);
            }
          });
        }
      );
    }
  })();
};

type BasicPositionDeserializer<A> = PositionSqlDeserializer<A> & { orNull(): PositionSqlDeserializer<A | null> };

function basicPositionDeserializer<A>({ guard, errorMessage }: DeserDefinition<A>): BasicPositionDeserializer<A> {
  const deserialize = (row: unknown[], idx: number): Result<A> => {
    if (row.length <= idx) {
      return Failure.raise(`There must be at least ${idx} values in a row`);
    }

    const value = row[idx];
    if (guard(value)) {
      return Success.of(value);
    } else {
      return Failure.raise(`Column '${idx}': ` + errorMessage(value));
    }
  };
  return new (class extends PositionSqlDeserializer<A> {
    constructor() {
      super(deserialize, 1);
    }

    orNull(): PositionSqlDeserializer<A | null> {
      return new PositionSqlDeserializer<A | null>((row: unknown[], idx: number): Result<A | null> => {
        return deserialize(row, idx).recover((messages) => {
          if (row.length > idx && row[idx] === null) {
            return Success.of(null);
          } else {
            return new Failure([...messages, `Column '${idx}': '${row[idx]}' is not null`]);
          }
        });
      }, 1);
    }
  })();
}

const strToBigInt = (s: string): Result<BigInt> => {
  try {
    return Success.of(BigInt(s));
  } catch (e) {
    return Failure.raise(`Cannot convert '${s}' to BigInt`);
  }
};

export const deser = {
  toBigInt: basicPositionDeserializer(toString).transform(strToBigInt),
  toNumber: basicPositionDeserializer(toNumber),
  toInteger: basicPositionDeserializer(toInteger),
  toString: basicPositionDeserializer(toString),
  toDate: basicPositionDeserializer(toDate),
  toNull: basicPositionDeserializer(toNull),
} as const;

export const namedDeser = {
  toBigInt: (col: string) => basicNamedDeserializer(toString)(col).transform(strToBigInt),
  toNumber: basicNamedDeserializer(toNumber),
  toInteger: basicNamedDeserializer(toInteger),
  toString: basicNamedDeserializer(toString),
  toDate: basicNamedDeserializer(toDate),
  toNull: basicNamedDeserializer(toNull),
} as const;
