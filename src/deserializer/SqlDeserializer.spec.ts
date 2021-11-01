import { SqlDeserializer } from './SqlDeserializer';
import { Failure, Success } from '../result/Result';

describe('SqlDeserializer', () => {
  const idDeserializer = new SqlDeserializer<number>(({ id }) => {
    if (typeof id === 'number') {
      return Success.of(id);
    } else {
      return Success.of(0);
    }
  });
  describe('map', () => {
    it('should transform the result of the serializer', () => {
      const result = idDeserializer.map((x) => x + 1);

      expect(result.deserialize({ id: 5 })).toStrictEqual(Success.of(6));
    });
  });
  describe('transform', () => {
    it('should transform the result of the serializer on success', () => {
      const result = idDeserializer.transform((x) => Success.of(x + 1));

      expect(result.deserialize({ id: 5 })).toStrictEqual(Success.of(6));
    });
    it('should throw an error on failure', () => {
      const result = idDeserializer.transform(() => Failure.raise('Expected failure'));

      expect(result.deserialize({ id: 5 })).toStrictEqual(Failure.raise('Expected failure'));
    });
  });

  describe('fromRecord', () => {
    it('should build a record deserializer', () => {
      const nameDeserializer = new SqlDeserializer((row) => Success.of(`${row.name}`));
      const deser = SqlDeserializer.fromRecord({ myId: idDeserializer, myName: nameDeserializer });

      expect(deser.deserialize({ id: 5, name: 'Georges' })).toStrictEqual(Success.of({ myId: 5, myName: 'Georges' }));
    });
  });
});
