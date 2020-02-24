import { SqlQuery } from './sql-query';

type SupportedValueType = string | number | boolean | Date | null;

export function sql(strings: TemplateStringsArray, ...values: SupportedValueType[]): SqlQuery {
  const text = strings.reduce((currText, str, i) => {
    return currText + '$' + i + str;
  });

  return new SqlQuery({ text, values });
}
