export function traverse<A extends readonly unknown[], B>(
  values: A,
  fn: (a: A[number], index: number) => Promise<B>
): Promise<{ [K in keyof A]: B }> {
  return values.reduce<Promise<readonly B[]>>((promiseAccumulator, value, index) => {
    return promiseAccumulator.then((accumulator) => fn(value, index).then((result) => [...accumulator, result]));
  }, Promise.resolve([])) as Promise<{ [K in keyof A]: B }>;
}
