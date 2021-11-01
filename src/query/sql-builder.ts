import { ClientBase } from 'pg';
import { SqlQuery, SupportedValueType } from './sql-query';

type AdvancedSupportedValueType = SupportedValueType | SqlQuery | SqlConstant;

class SqlConstant {
  private sqlConstant: 'sqlConstant' = 'sqlConstant';
  constructor(public str: string) {}
}

export function SqlConst(str: string): SqlConstant {
  return new SqlConstant(str);
}

export function SqlBuilder(client: ClientBase) {
  return <T extends AdvancedSupportedValueType[]>(strings: ReadonlyArray<string>, ...values: T): SqlQuery => {
    const flattenedValues = values.flatMap<SupportedValueType>((v) => {
      if (v instanceof SqlQuery) {
        return v.values;
      } else if (v instanceof SqlConstant) {
        return [];
      } else {
        return [v];
      }
    });

    const flattenedStr = values
      .map((q) => {
        if (q instanceof SqlConstant) {
          return new SqlQuery(client, [q.str], []);
        } else {
          return q;
        }
      })
      .reduce<string[]>(
        (acc, v, i) => {
          const txt = strings[i + 1];
          if (v instanceof SqlQuery) {
            if (v.strings.length > 1) {
              const [head, ...tail] = v.strings;
              const last = tail[tail.length - 1];
              const middle = tail.slice(0, -1);

              acc[acc.length - 1] = acc[acc.length - 1] + head;
              acc.push(...middle);
              acc.push(last + txt);
            } else if (v.strings.length === 1) {
              const str = v.strings[0];

              acc[acc.length - 1] = acc[acc.length - 1] + str + txt;
            } else {
              acc.push(txt);
            }
          } else {
            acc.push(txt);
          }

          return acc;
        },
        [strings[0]]
      );

    return new SqlQuery(client, flattenedStr, flattenedValues);
  };
}
