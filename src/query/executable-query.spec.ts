import fc, { Arbitrary } from 'fast-check';
import { ExecutableQuery, QueryableClient } from './executable-query';

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
          expect(query.map(id).run(fakeClient)).toStrictEqual(query.run(fakeClient));
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
            expect(query.map(fn).map(fn2).run(fakeClient)).toStrictEqual(query.map((x) => fn2(fn(x))).run(fakeClient));
          }
        )
      );
    });
  });
});
