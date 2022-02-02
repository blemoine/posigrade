import { NamedDeserializer, NullDeserializer, toNamedDeserializer } from './DeserDefinition';
import { Failure, sequenceResult, Success } from '../result/Result';

const deserDefinition = {
  toNumberDef: {
    guard: (value: unknown): value is number => typeof value === 'number',
    errorMessage: (value: unknown) => `'${value}' is not a number`,
  },
  toIntegerDef: {
    guard: (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value),
    errorMessage: (value: unknown) => `'${value}' is not an integer`,
  },
  toStringDef: {
    guard: (value: unknown): value is string => typeof value === 'string',
    errorMessage: (value: unknown) => `'${value}' is not a string`,
  },
  toDateDef: {
    guard: (value: unknown): value is Date => value instanceof Date,
    errorMessage: (value: unknown) => `'${value}' is not a Date`,
  },
  toJsonObjectDef: {
    guard: (value: unknown): value is object => value != null && typeof value == 'object',
    errorMessage: (value: unknown) => `'${value}' is not an object`,
  },
  toBooleanObjectDef: {
    guard: (value: unknown): value is boolean => typeof value === 'boolean',
    errorMessage: (value: unknown) => `'${value}' is not a boolean`,
  },
  toArrayDef: {
    guard: (value: unknown): value is ReadonlyArray<unknown> => Array.isArray(value),
    errorMessage: (value: unknown) => `'${value}' is not an array`,
  },
} as const;

export const deser = {
  toNumber: toNamedDeserializer(deserDefinition.toNumberDef),
  toString: toNamedDeserializer(deserDefinition.toStringDef),
  toInteger: toNamedDeserializer(deserDefinition.toIntegerDef),
  toNull: NullDeserializer,
  toDate: toNamedDeserializer(deserDefinition.toDateDef),
  toJsonObject: toNamedDeserializer(deserDefinition.toJsonObjectDef),
  toBoolean: toNamedDeserializer(deserDefinition.toBooleanObjectDef),
  floatStringToNumber: toNamedDeserializer(deserDefinition.toStringDef).map<number>((str) => Number.parseFloat(str)),
  decimalToNumber: toNamedDeserializer(deserDefinition.toStringDef).transform<number>((str) => {
    const floatResult = Number.parseFloat(str);
    const floatResultAsStr = floatResult.toString();

    if (Number.isInteger(floatResult) && floatResultAsStr === str) {
      return Success.of(floatResult);
    } else if (
      str === (Number.isInteger(floatResult) ? floatResultAsStr + '.' : floatResultAsStr).padEnd(str.length, '0')
    ) {
      return Success.of(floatResult);
    } else {
      return Failure.raise(`Value '${str}' is not convertible without loss to a number`);
    }
  }),
  toArray: <T>(elementDeserializer: NamedDeserializer<T>): NamedDeserializer<readonly T[]> => {
    return toNamedDeserializer(deserDefinition.toArrayDef)
      .transform((arr) =>
        sequenceResult(arr.map((v, i) => elementDeserializer.forColumn(`_${i}`).deserialize({ [`_${i}`]: v })))
      )
      .mapFailure((col, messages) => [`Items in array of col '${col}' are not valid`, ...messages]);
  },
};
