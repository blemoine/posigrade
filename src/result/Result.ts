import { NonEmptyArray } from '../utils/non-empty-array';

export class Success<T> {
  static of<T>(value: T): Success<T> {
    return new Success(value);
  }
  constructor(public readonly value: T) {}

  map<B>(mapper: (t: T) => B): Result<B> {
    return Success.of(mapper(this.value));
  }

  chain<B>(mapper: (t: T) => Result<B>): Result<B> {
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

/**
 * A class representing one or multiple errors.
 * When used something merging multiple `Result`s (like `zip` or `sequenceResult`), it will accumulate the errors.
 *
 * Most of the time, you'll want to use the `raise` static function to create a Failure with on error message.
 *
 * @example
 *
 * ```
 * const failure1 = Failure.raise('this is an error');
 * const failure2 = Failure.raise('another error');
 *
 * const failure = failure1.zip(failure2);
 *
 * failure.getOrThrow() // will `throw new Error('this is an error, another error')`
 * ```
 *
 */
export class Failure<T> {
  static raise<T>(message: string): Failure<T> {
    return new Failure<T>([message]);
  }

  constructor(public readonly messages: NonEmptyArray<string>) {}
  map<B>(_mapper: (t: T) => B): Result<B> {
    return this as any;
  }
  chain<B>(_mapper: (t: T) => Result<B>): Result<B> {
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

/**
 * A type representing something succcessful or failed.
 *
 * The goal is to have a way to accumulate multiple error messages
 * instead of failing at the first error encountered
 */
export type Result<T> = Success<T> | Failure<T>;
