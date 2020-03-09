import { SqlQuery } from './sql-query';

type BaseSupportedValueType = string | number | boolean | Date | null;
type SupportedValueType = BaseSupportedValueType | Array<BaseSupportedValueType>;

export function sql(strings: ReadonlyArray<string>, ...values: SupportedValueType[]): SqlQuery {
  const text = strings.reduce((currText, str, i) => {
    return currText + '$' + i + str;
  });

  return new SqlQuery({ text, values });
}

export class SqlFragment {
  constructor(private strings: ReadonlyArray<string>, private values: SupportedValueType[]) {}

  concat(fr: SqlFragment): SqlFragment {
    const firstFrStr = fr.strings[0];
    if (this.values.length === 0) {
      return new SqlFragment([this.strings[0] + firstFrStr, ...fr.strings.slice(1)], [...this.values, ...fr.values]);
    }
    const lastStr = this.strings[this.strings.length - 1];
    const baseStr = lastStr === '' ? this.strings.slice(0, this.strings.length - 1) : this.strings;

    const baseFrStr = firstFrStr === '' ? fr.strings.slice(1) : fr.strings;
    const strings = [...baseStr, ...baseFrStr];
    return new SqlFragment(strings, [...this.values, ...fr.values]);
  }

  toQuery(): SqlQuery {
    return sql(this.strings, ...this.values);
  }
}
export function sqlFrag(strings: TemplateStringsArray | string, ...values: SupportedValueType[]): SqlFragment {
  const strs = typeof strings === 'string' ? [strings] : strings;

  return new SqlFragment(strs, values);
}
