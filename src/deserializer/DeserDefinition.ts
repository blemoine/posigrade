import { SqlDeserializer } from './SqlDeserializer';
import { Failure, Success } from '../result/Result';

export type DeserDefinition<A> = {
  guard: (x: unknown) => x is A;
  errorMessage: (value: unknown) => string;
};

export function toNamedDeserializer<T>({ guard, errorMessage }: DeserDefinition<T>): NamedDeserializer<T> {
  return new NamedDeserializer(
    (col: string) =>
      new SqlDeserializer<T>((row) => {
        if (!Object.prototype.hasOwnProperty.call(row, col)) {
          throw new Error(`No column named '${col}' exists in the list of cols '${Object.keys(row).join(', ')}'`);
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

export class NamedDeserializer<T> {
  constructor(public forColumn: (col: string) => SqlDeserializer<T>) {}

  or<U>(other: NamedDeserializer<U>): NamedDeserializer<T | U> {
    return new NamedDeserializer<T | U>((col) => this.forColumn(col).or(other.forColumn(col)));
  }
}
