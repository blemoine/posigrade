import * as fc from 'fast-check';
import { Arbitrary } from 'fast-check';
import { Failure, Result, Success } from './Result';
import { NonEmptyArray } from '../utils/non-empty-array';

export const id = <T>(x: T): T => x;

export const arbSuccess = <T>(tArb: Arbitrary<T>): Arbitrary<Success<T>> => tArb.map((i) => Success.of(i));
export const arbFailure: Arbitrary<Failure<any>> = fc.string().map((message) => Failure.raise(message));
export const arbResult = <T>(tArb: Arbitrary<T>): Arbitrary<Result<T>> => fc.oneof(arbSuccess(tArb), arbFailure);
export const arbNonEmptyArray = <T>(arbT: Arbitrary<T>): Arbitrary<NonEmptyArray<T>> =>
  arbT.chain((t) => fc.array(arbT).map((arrT) => [t, ...arrT]));
