import { ClientBase } from 'pg';
import { SqlQuery, SupportedValueType } from './sql-query';
import { addInArray, NonEmptyArray } from '../utils/non-empty-array';
import { cannotHappen } from '../utils/cannotHappen';

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
      .reduce<NonEmptyArray<string>>(
        (acc, v, i) => {
          const txt = strings[i + 1];
          if (v instanceof SqlQuery) {
            const [head, ...tail] = v.strings;
            const accWithoutLast = acc.slice(0, -1);
            const accLast = acc[acc.length - 1];

            if (tail.length > 0) {
              const last = tail[tail.length - 1];
              const middle = tail.slice(0, -1);

              return addInArray(accWithoutLast, accLast + head, ...middle, last + txt);
            } else {
              return addInArray(accWithoutLast, accLast + head + txt);
            }
          } else {
            return addInArray(acc, txt);
          }
        },
        [strings[0]]
      );

    return new SqlQuery(client, flattenedStr, flattenedValues);
  };
}
