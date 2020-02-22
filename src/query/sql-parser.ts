//import {SqlDeserializer} from "../serde/SqlDeserializer";

import {QueryConfig} from "pg";

type SupportedValueType = string | number | boolean;

export class Sql {
  constructor(public queryConfig: QueryConfig) {}

//  list<A>(deserializer: SqlDeserializer<A> ): ConnectionIO<List<A>>
}

export function sql(strings: TemplateStringsArray, ...values: SupportedValueType[]): Sql {
  const text = strings.reduce((currText, str, i) => {
    return currText + '$' + i + str;
  });

  return new Sql({ text, values });
}
