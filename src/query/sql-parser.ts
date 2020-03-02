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
    const lastStr = this.strings[this.strings.length - 1];
    const baseStr = lastStr === '' ? this.strings.slice(0, this.strings.length - 1) : this.strings;

    const firstFrStr = fr.strings[0];
    const baseFrStr = firstFrStr === '' ? fr.strings.slice(1) : fr.strings;

    const strings = [...baseStr, ...baseFrStr];
    return new SqlFragment(strings, [...this.values, ...fr.values]);
  }

  toQuery(): SqlQuery {
    return sql(this.strings, ...this.values);
  }
}
export function sqlFrag(strings: TemplateStringsArray, ...values: SupportedValueType[]): SqlFragment {
  return new SqlFragment(strings, values);
}
