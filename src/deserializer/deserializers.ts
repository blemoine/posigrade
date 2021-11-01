import { DeserDefinition, toNamedDeserializer } from './DeserDefinition';

const toNumberDef: DeserDefinition<number> = {
  guard: (value): value is number => typeof value === 'number',
  errorMessage: (value) => `'${value}' is not a number`,
};
const toIntegerDef: DeserDefinition<number> = {
  guard: (value): value is number => typeof value === 'number' && Number.isInteger(value),
  errorMessage: (value) => `'${value}' is not an integer`,
};
const toStringDef: DeserDefinition<string> = {
  guard: (value): value is string => typeof value === 'string',
  errorMessage: (value) => `'${value}' is not a string`,
};

const toNullDef: DeserDefinition<null> = {
  guard: (value): value is null => value === null,
  errorMessage: (value) => `'${value}' is not null`,
};
const toDateDef: DeserDefinition<Date> = {
  guard: (value): value is Date => value instanceof Date,
  errorMessage: (value) => `'${value}' is not a Date`,
};
const toJsonObjectDef: DeserDefinition<object> = {
  guard: (value): value is object => value != null && typeof value == 'object',
  errorMessage: (value) => `'${value}' is not an object`,
};

export const named = {
  toNumber: toNamedDeserializer(toNumberDef),
  toString: toNamedDeserializer(toStringDef),
  toInteger: toNamedDeserializer(toIntegerDef),
  toNull: toNamedDeserializer(toNullDef),
  toDate: toNamedDeserializer(toDateDef),
  toJsonObject: toNamedDeserializer(toJsonObjectDef),
};
