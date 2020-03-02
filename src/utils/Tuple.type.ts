export type Unshift<List extends any[], Item> = ((first: Item, ...rest: List) => any) extends (...list: infer R) => any
  ? R
  : never;
