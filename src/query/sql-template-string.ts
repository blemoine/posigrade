import { SqlQuery, SupportedValueType } from './sql-query';
import { addInArray, NonEmptyArray } from '../utils/non-empty-array';

type AdvancedSupportedValueType = SupportedValueType | SqlQuery | SqlConstant;

/**
 * This class is not exported as we want users to use the below function `SqlConst`.
 * But we need a class to be able to use `instanceof` operator
 */
class SqlConstant {
  /* as we use `instanceof` to test for instance of this class, we need to ensure
   * users won't send `{constantString: 'something'}` directly.
   * TS will ensure that property _only if_ there is a private attribute in the class.
   */
  private _sqlConstant: 'sqlConstant' = 'sqlConstant';
  constructor(public constantString: string) {}
}

/**
 * This function let user build a maker to ensure that the `Sql` template string
 * doesn't interpret `constantString` as a named parameter.
 *
 * It's particularly useful when creating queries dynamically
 *
 * @param str - the constant string to use
 * @returns an object that will be used as a string constant in an SQL template string
 *
 * @example
 *
 * ```
 * const field = 'name';
 * Sql`SELECT ${field}`; // Will be sent as `SELECT $1` to postgres
 *
 * Sql`SELECT ${SqlConst(field)}`; // Will be sent as `SELECT name` to postgres
 * ```
 */
export function SqlConst(str: string): SqlConstant {
  return new SqlConstant(str);
}

/**
 * Template String function to build an SqlQuery object.
 * Variables used in the template string will be sent to postgres as named parameter,
 * preventing potential SQL Injection problem.
 *
 * If you need to use a variable _without_ transforming it to named parameter, look at `SqlConst`
 * (for example, to build dynamic queries)
 *
 * @param strings
 * @param values
 *
 *
 * @example
 *
 * ```
 * const id = 1;
 * Sql`SELECT * FROM my_tables WHERE id = ${id}`
 *
 * ```
 */
export function Sql<T extends AdvancedSupportedValueType[]>(strings: ReadonlyArray<string>, ...values: T): SqlQuery {
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
        return new SqlQuery([q.constantString], []);
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

  return new SqlQuery(flattenedStr, flattenedValues);
}
