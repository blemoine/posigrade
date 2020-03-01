import { SqlQuery } from './sql-query';

type BaseSupportedValueType = string | number | boolean | Date | null;
type SupportedValueType = BaseSupportedValueType | Array<BaseSupportedValueType>;

export function sql(strings: TemplateStringsArray, ...values: SupportedValueType[]): SqlQuery {
  const text = strings.reduce((currText, str, i) => {
    return currText + '$' + i + str;
  });

  return new SqlQuery({ text, values });
}
