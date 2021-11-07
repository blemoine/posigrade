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
  const nameDeserializer = new SqlDeserializer((row) => Success.of(`${row.name}`));
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

  describe('chain', () => {
    it('should chain the result of the serializer on success', () => {
      const result = idDeserializer.chain(() => nameDeserializer);

      expect(result.deserialize({ id: 5, name: 'test' })).toStrictEqual(Success.of('test'));
    });
  });

  describe('fromRecord', () => {
    it('should build a record deserializer', () => {
      const deser = SqlDeserializer.fromRecord({ myId: idDeserializer, myName: nameDeserializer });

      expect(deser.deserialize({ id: 5, name: 'Georges' })).toStrictEqual(Success.of({ myId: 5, myName: 'Georges' }));
    });
    it('should work an explicitly defined interface', () => {
      interface User {
        id: number;
        name: string;
      }

      const deser = SqlDeserializer.fromRecord<User>({ id: idDeserializer, name: nameDeserializer });

      expect(deser.deserialize({ id: 5, name: 'Georges' })).toStrictEqual(Success.of({ id: 5, name: 'Georges' }));
    });
  });

  describe('fromTuple', () => {
    it('should build a record deserializer', () => {
      const deser: SqlDeserializer<readonly [number, string]> = SqlDeserializer.fromTuple([
        idDeserializer,
        nameDeserializer,
      ] as const);

      expect(deser.deserialize({ id: 5, name: 'Georges' })).toStrictEqual(Success.of([5, 'Georges']));
    });
  });
});
