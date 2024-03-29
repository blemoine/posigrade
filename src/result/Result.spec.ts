import { Failure, Result, sequenceResult, Success } from './Result';
import * as fc from 'fast-check';
import { arbFailure, arbNonEmptyArray, arbResult, id } from './Result.tests.helper';

describe('Result', () => {
  describe('zip', () => {
    it('should accumulate errors', () => {
      const f = Failure.raise('err1');
      const f2 = Failure.raise('err2');

      const result = f.zip(f2);

      expect(result).toStrictEqual(new Failure(['err1', 'err2']));
    });
    it('should create a pair from success values', () => {
      const r = Success.of(1);
      const r2 = Success.of('2');

      const result = r.zip(r2);

      expect(result).toStrictEqual(Success.of([1, '2']));
    });
    it('should return the error if one is Failure and the other is success', () => {
      const r = Success.of(1);
      const r2 = Failure.raise('err2');

      expect(r.zip(r2)).toStrictEqual(r2);
      expect(r2.zip(r)).toStrictEqual(r2);
    });
  });

  describe('getOrThrow', () => {
    it('should return the value if it is a Success', () => {
      fc.assert(
        fc.property(fc.anything(), (a) => {
          expect(Success.of(a).getOrThrow()).toStrictEqual(a);
        })
      );
    });
    it('should throw an error if it is a Failure', () => {
      fc.assert(
        fc.property(fc.string(), (message) => {
          expect(() => Failure.raise(message).getOrThrow()).toThrow(new Error(message));
        })
      );
    });
  });

  describe('recover', () => {
    it('should do nothing if it is a Success', () => {
      fc.assert(
        fc.property(fc.anything(), fc.func(arbResult(fc.anything())), (a, fn) => {
          expect(Success.of(a).recover(fn)).toStrictEqual(Success.of(a));
        })
      );
    });
    it('should return the recovered result if it is a Failure', () => {
      fc.assert(
        fc.property(fc.string(), arbResult(fc.anything()), (message, result) => {
          expect(Failure.raise(message).recover(() => result)).toStrictEqual(result);
        })
      );
    });
  });

  describe('should form a functor', () => {
    it('should respect identity', () => {
      fc.assert(
        fc.property(arbResult(fc.anything()), (result) => {
          expect(result.map(id)).toStrictEqual(result);
        })
      );
    });
    it('should respect composition', () => {
      fc.assert(
        fc.property(arbResult(fc.anything()), fc.func(fc.anything()), fc.func(fc.anything()), (result, fn, fn2) => {
          expect(result.map(fn).map(fn2)).toStrictEqual(result.map((x) => fn2(fn(x))));
        })
      );
    });
  });

  describe('should form a monad', () => {
    it('should respect right identity', () => {
      fc.assert(
        fc.property(arbResult(fc.anything()), (result) => {
          expect(result.chain((x) => Success.of(x))).toStrictEqual(result);
        })
      );
    });

    it('should respect left identity', () => {
      fc.assert(
        fc.property(fc.anything(), fc.func(arbResult(fc.anything())), (a, fn) => {
          expect(Success.of(a).chain(fn)).toStrictEqual(fn(a));
        })
      );
    });

    it('should respect composition', () => {
      fc.assert(
        fc.property(
          arbResult(fc.anything()),
          fc.func(arbResult(fc.anything())),
          fc.func(arbResult(fc.anything())),
          (result, fn, fn2) => {
            expect(result.chain(fn).chain(fn2)).toStrictEqual(result.chain((x) => fn(x).chain(fn2)));
          }
        )
      );
    });
  });

  describe('sequenceResult', () => {
    it('should transform a sequence of Success to a Success sequence', () => {
      fc.assert(
        fc.property(fc.array(fc.anything()), (values) => {
          expect(sequenceResult(values.map((v) => Success.of(v)))).toStrictEqual(Success.of(values));
        })
      );
    });

    it('should accumulate the failures if there is some', () => {
      fc.assert(
        fc.property(fc.array(fc.anything()), arbNonEmptyArray(arbFailure), (values, failures) => {
          expect(sequenceResult([...values.map((v) => Success.of(v)), ...failures])).toStrictEqual(
            new Failure(failures.flatMap((f) => f.messages) as any)
          );
        })
      );
    });
  });
});
