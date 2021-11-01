export type NonEmptyArray<T> = readonly [T, ...T[]];

export function addInArray<T>(arr: readonly T[], t: T, ...ts: readonly T[]): NonEmptyArray<T> {
  return [...arr, t, ...ts] as unknown as NonEmptyArray<T>;
}
