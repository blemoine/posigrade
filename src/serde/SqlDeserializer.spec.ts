import { deser, namedDeser, NamedSqlDeserializer, PositionSqlDeserializer } from './SqlDeserializer';
import { Failure, Success } from '../result/Result';

describe('SqlDeserialize', () => {
  it('should be able to combine deserializer', () => {
    const pair = deser.toString.zip(deser.toInteger);

    const result = pair.deserialize(['Georges', 12]);

    expect(result).toStrictEqual(Success.of(['Georges', 12]));
  });

  it('should be able to combine multiple deserializers', () => {
    const tuple = PositionSqlDeserializer.sequenceDeser(
      deser.toString,
      deser.toInteger,
      deser.toInteger,
      deser.toString
    );

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
  it('should be able to combine name deserializers with a or', () => {
    const strOrNull = namedDeser.toString('id').or(namedDeser.toNull('id'));

    const result = strOrNull.deserialize({ id: 'Georges' });

    expect(result).toStrictEqual(Success.of('Georges'));

    const result2 = strOrNull.deserialize({ id: null });

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

describe('orNull', () => {
  it('should support a simple way to set a nullable base position deserializer', () => {
    const deserWithNull = deser.toString.orNull();

    const result = deserWithNull.deserialize([null]);
    expect(result).toStrictEqual(Success.of(null));
  });
  it('should support display a clear error message', () => {
    const deserWithNull = deser.toString.orNull();

    const result = deserWithNull.deserialize([1]);
    expect(result).toStrictEqual(new Failure(["Column '0': '1' is not a string", "Column '0': '1' is not null"]));
  });
});

describe('sequenceDeserRecord', () => {
  it('should support the deserialization without an explicit column name', () => {
    const userDeser = NamedSqlDeserializer.sequenceDeserRecord({
      id: namedDeser.toInteger('id'),
      firstName: namedDeser.toString('first_name'),
      age: namedDeser.toInteger,
    });

    // eslint-disable-next-line @typescript-eslint/camelcase
    const result = userDeser.deserialize({ id: 1, first_name: 'Georges', age: 45 });

    expect(result).toStrictEqual(Success.of({ id: 1, firstName: 'Georges', age: 45 }));
  });
});
