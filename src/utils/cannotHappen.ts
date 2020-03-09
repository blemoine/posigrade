export function cannotHappen(param: never): never {
  throw new Error(`param ${param} is not a valid value`);
}
