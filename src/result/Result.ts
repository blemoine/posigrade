import { NonEmptyArray } from '../utils/non-empty-array';

export class Success<T> {
  static of<T>(value: T): Success<T> {
    return new Success(value);
  }
  constructor(public readonly value: T) {}

  map<B>(mapper: (t: T) => B): Result<B> {
    return Success.of(mapper(this.value));
  }

  flatMap<B>(mapper: (t: T) => Result<B>): Result<B> {
    return mapper(this.value);
  }

  getOrThrow(): T {
    return this.value;
  }

  recover<B>(_fn: (messages: NonEmptyArray<string>) => Result<B>): Result<T | B> {
    return this;
  }

  zip<B>(result: Result<B>): Result<[T, B]> {
    return result.map((b) => [this.value, b]);
  }
}
export class Failure<T> {
  static raise<T>(message: string): Failure<T> {
    return new Failure<T>([message]);
  }

  constructor(public readonly messages: NonEmptyArray<string>) {}
  map<B>(_mapper: (t: T) => B): Result<B> {
    return this as any;
  }
  flatMap<B>(_mapper: (t: T) => Result<B>): Result<B> {
    return this as any;
  }
  getOrThrow(): T {
    throw new Error(this.messages.join(', '));
  }
  recover<B>(fn: (messages: NonEmptyArray<string>) => Result<B>): Result<T | B> {
    return fn(this.messages);
  }

  zip<B>(result: Result<B>): Result<[T, B]> {
    if (result instanceof Failure) {
      return new Failure([...this.messages, ...result.messages]);
    } else {
      return this as any;
    }
  }
}

export function sequenceResult<A>(arr: Array<Result<A>>): Result<Array<A>> {
  return arr.reduce<Result<Array<A>>>((maybeResults, maybeValue) => {
    return maybeResults.zip(maybeValue).map(([acc, value]) => [...acc, value]);
  }, Success.of([]));
}

export type Result<T> = Success<T> | Failure<T>;
