import { Failure, Success } from './Result';

describe('Result.zip', () => {
  test('should accumulate errors', () => {
    const f = Failure.raise('err1');
    const f2 = Failure.raise('err2');

    const result = f.zip(f2);

    expect(result).toStrictEqual(new Failure(['err1', 'err2']));
  });
  test('should create a pair from success values', () => {
    const r = Success.of(1);
    const r2 = Success.of('2');

    const result = r.zip(r2);

    expect(result).toStrictEqual(Success.of([1, '2']));
  });
  test('should return the error if one is Failure and the other is success', () => {
    const r = Success.of(1);
    const r2 = Failure.raise('err2');

    expect(r.zip(r2)).toStrictEqual(r2);
    expect(r2.zip(r)).toStrictEqual(r2);
  });
});
