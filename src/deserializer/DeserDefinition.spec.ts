import { NamedDeserializer, toNamedDeserializer } from './DeserDefinition';
import { Failure, Success } from '../result/Result';
import * as fc from 'fast-check';
import { Arbitrary } from 'fast-check';
import { SqlDeserializer } from './SqlDeserializer';
import { arbResult } from '../result/Result.tests.helper';
import { deser } from './deserializers';

const id = <T>(x: T): T => x;
const arbNamedSerializer = <T>(output: Arbitrary<T>): Arbitrary<NamedDeserializer<T>> =>
  fc.func(arbResult(output)).map((fn) => new NamedDeserializer(() => new SqlDeserializer<T>(fn)));

describe('toNamedDeserializer', () => {
  it('should throw an error if we try to get column that does not exist', () => {
    const deser = toNamedDeserializer<unknown>({
      guard: (x): x is unknown => !!x,
      errorMessage: (v) => `expected error message with value ${v}`,
    });

    expect(deser.forColumn('test_col').deserialize({ id: '123', age: 1 })).toStrictEqual(
      Failure.raise("No column named 'test_col' exists in the list of cols 'id, age'")
    );
  });
  it('should return a Failure if the column exist but the guard return false', () => {
    const deser = toNamedDeserializer<unknown>({
      guard: (_x): _x is unknown => false,
      errorMessage: (v) => `expected error message with value ${v}`,
    });

    expect(deser.forColumn('age').deserialize({ id: '123', age: 1 })).toStrictEqual(
      Failure.raise("Column 'age': expected error message with value 1")
    );
  });
  it('should return a Success if the column exist but the guard return true', () => {
    const deser = toNamedDeserializer<unknown>({
      guard: (_x): _x is unknown => true,
      errorMessage: (v) => `expected error message with value ${v}`,
    });

    expect(deser.forColumn('age').deserialize({ id: '123', age: 1 })).toStrictEqual(Success.of(1));
  });
});

describe('NamedDeserializer', () => {
  describe('or', () => {
    it('should test multiple deserializer and return the first value that works', () => {
      const deserializer: NamedDeserializer<number | null> = deser.toNumber.or(deser.decimalToNumber).orNull();

      expect(deserializer.forColumn('a').deserialize({ a: '2' })).toStrictEqual(Success.of(2));
    });

    it('should test multiple deserializer and return aggregated error if none works', () => {
      const deserializer: NamedDeserializer<number | null> = deser.toNumber.or(deser.decimalToNumber).orNull();

      expect(deserializer.forColumn('a').deserialize({ a: 'test' })).toStrictEqual(
        new Failure([
          "Column 'a': 'test' is not a number",
          "Value 'test' is not convertible without loss to a number",
          "Column 'a': 'test' is not null",
        ])
      );
    });
  });
  describe('should form a functor', () => {
    it('should respect identity', () => {
      fc.assert(
        fc.property(arbNamedSerializer(fc.anything()), (serializer) => {
          expect(serializer.map(id).forColumn('a').deserialize({ a: 1 })).toStrictEqual(
            serializer.forColumn('a').deserialize({ a: 1 })
          );
        })
      );
    });
    it('should respect composition', () => {
      fc.assert(
        fc.property(
          arbNamedSerializer(fc.anything()),
          fc.func(fc.anything()),
          fc.func(fc.anything()),
          (serializer, fn, fn2) => {
            expect(serializer.map(fn).map(fn2).forColumn('a').deserialize({ a: 1 })).toStrictEqual(
              serializer
                .map((x) => fn2(fn(x)))
                .forColumn('a')
                .deserialize({ a: 1 })
            );
          }
        )
      );
    });
  });
});
