import { deser, namedDeser, sequenceDeser } from './SqlDeserializer';
import { Failure, Success } from '../result/Result';

describe('SqlDeserialize', () => {
  it('should be able to combine deserializer', () => {
    const pair = deser.toString.zip(deser.toInteger);

    const result = pair.deserialize(['Georges', 12]);

    expect(result).toStrictEqual(Success.of(['Georges', 12]));
  });

  it('should be able to combine multiple deserializers', () => {
    const tuple = sequenceDeser(deser.toString, deser.toInteger, deser.toInteger, deser.toString);

    const result = tuple.deserialize(['Georges', 12, 45, 'Abitbol']);

    expect(result).toStrictEqual(Success.of(['Georges', 12, 45, 'Abitbol']));
  });

  it('should be able to combine deserializers with a or', () => {
    const strOrNull = deser.toString.or(deser.toNull);

    const result = strOrNull.deserialize(['Georges']);

    expect(result).toStrictEqual(Success.of('Georges'));

    const result2 = strOrNull.deserialize([null]);

    expect(result2).toStrictEqual(Success.of(null));
  });

  it('should be able to deserialize bigInt', () => {
    const result = deser.toBigInt.deserialize(['1234']);

    expect(result).toStrictEqual(Success.of(BigInt('1234')));
  });

  it('should be able to deserialize a named bigInt', () => {
    const result = namedDeser.toBigInt('nb').deserialize({ nb: '1234' });

    expect(result).toStrictEqual(Success.of(BigInt('1234')));
  });

  it('should fail to convert an invalid value', () => {
    const result = deser.toBigInt.deserialize(['not a bigint']);

    expect(result).toStrictEqual(Failure.raise("Cannot convert 'not a bigint' to BigInt"));
  });

  it('should be able to deserialize number', () => {
    const result = deser.toNumber.deserialize([12.34]);

    expect(result).toStrictEqual(Success.of(12.34));
  });
});
