import fc, { Arbitrary } from 'fast-check';
import { ExecutableQuery, QueryableClient } from './executable-query';
import { Success } from '../result/Result';

const id = <T>(t: T): T => t;
function arbExecutableQuery<T>(arbT: Arbitrary<T>): Arbitrary<ExecutableQuery<T>> {
  return arbT.map(ExecutableQuery.of);
}

describe('ExecutableQuery', () => {
  const fakeClient: QueryableClient = {
    query: (): any => {},
  };
  describe('of', () => {
    it('should build an ExecutableQuery always returning the specified value', () => {
      return fc.assert(
        fc.asyncProperty(fc.anything(), async (a) => {
          const query = ExecutableQuery.of(a);

          const result = await query.run(fakeClient);
          expect(result).toStrictEqual(a);
        })
      );
    });
  });

  describe('should form a functor', () => {
    it('should respect identity', () => {
      return fc.assert(
        fc.asyncProperty(arbExecutableQuery(fc.anything()), async (query) => {
          const result = await query.map(id).run(fakeClient);
          const expected = await query.run(fakeClient);
          expect(result).toStrictEqual(expected);
        })
      );
    });
    it('should respect composition', () => {
      return fc.assert(
        fc.asyncProperty(
          arbExecutableQuery(fc.anything()),
          fc.func(fc.anything()),
          fc.func(fc.anything()),
          async (query, fn, fn2) => {
            const result = await query.map(fn).map(fn2).run(fakeClient);
            const expected = await query.map((x) => fn2(fn(x))).run(fakeClient);
            expect(result).toStrictEqual(expected);
          }
        )
      );
    });
  });
  describe('should form a monad', () => {
    it('should respect right identity', () => {
      return fc.assert(
        fc.asyncProperty(arbExecutableQuery(fc.anything()), async (query) => {
          const result = await query.chain((x) => ExecutableQuery.of(x)).run(fakeClient);
          const expected = await query.run(fakeClient);
          expect(result).toStrictEqual(expected);
        })
      );
    });

    it('should respect left identity', () => {
      return fc.assert(
        fc.asyncProperty(fc.anything(), fc.func(arbExecutableQuery(fc.anything())), async (a, fn) => {
          const result = await ExecutableQuery.of(a).chain(fn).run(fakeClient);
          const expected = await fn(a).run(fakeClient);
          expect(result).toStrictEqual(expected);
        })
      );
    });

    it('should respect composition', () => {
      return fc.assert(
        fc.asyncProperty(
          arbExecutableQuery(fc.anything()),
          fc.func(arbExecutableQuery(fc.anything())),
          fc.func(arbExecutableQuery(fc.anything())),
          async (query, fn, fn2) => {
            const result = await query.chain(fn).chain(fn2).run(fakeClient);
            const expected = await query.chain((x) => fn(x).chain(fn2)).run(fakeClient);
            expect(result).toStrictEqual(expected);
          }
        )
      );
    });
  });
});
