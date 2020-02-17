type SupportedValueType = string | number | boolean;

export class Sql {
  constructor(public text: string, public values: SupportedValueType[]) {}
}

export function sql(strings: TemplateStringsArray, ...values: SupportedValueType[]): Sql {
  const text = strings.reduce((currText, str, i) => {
    return currText + '$' + i + str;
  });

  return { text, values };
}
