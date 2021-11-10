import { deser } from './deserializers';
import { Failure, Success } from '../result/Result';

describe('deser', () => {
  describe('decimalToNumber', () => {
    it('should return the decimal string as a number if it is possible to convert', () => {
      const result = deser.decimalToNumber.forColumn('sum').deserialize({ sum: '1.234' });
      expect(result).toStrictEqual(Success.of(1.234));
    });
    it('should return the decimal string as a number if the number ends with some 0', () => {
      const result = deser.decimalToNumber.forColumn('sum').deserialize({ sum: '4.15000' });
      expect(result).toStrictEqual(Success.of(4.15));
    });
    it('should return the decimal string as a number if the number is an integer ending with some 0', () => {
      const result = deser.decimalToNumber.forColumn('sum').deserialize({ sum: '12.00000' });
      expect(result).toStrictEqual(Success.of(12));
    });

    it('should return a failure if the decimal string is not a number', () => {
      const result = deser.decimalToNumber.forColumn('sum').deserialize({ sum: '4notAnumber' });
      expect(result).toStrictEqual(Failure.raise("Value '4notAnumber' is not convertible without loss to a number"));
    });
    it('should return a failure if the decimal string overflows', () => {
      const result = deser.decimalToNumber.forColumn('sum').deserialize({ sum: '90071992547409923' });
      expect(result).toStrictEqual(
        Failure.raise("Value '90071992547409923' is not convertible without loss to a number")
      );
    });
  });
});
