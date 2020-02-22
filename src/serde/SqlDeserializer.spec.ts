import { deser } from './SqlDeserializer';
import { Success } from '../result/Result';

describe('SqlDeserialize', () => {
  it('should be able to combine deserializer', () => {
    const pair = deser.toString.zip(deser.toInteger);

    const result = pair.deserialize(['Georges', 12]);

    expect(result).toStrictEqual(Success.of(['Georges', 12]));
  });
});
