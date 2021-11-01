import { ClientBase, QueryConfig } from 'pg';
import { SqlDeserializer } from '../deserializer/SqlDeserializer';
import { sequenceResult } from '../result/Result';

export type BaseSupportedValueType = string | number | boolean | Date | null;
export type SupportedValueType = BaseSupportedValueType | Array<BaseSupportedValueType>;

export class SqlQuery {
  public readonly queryText: string;
  constructor(
    private readonly client: ClientBase,
    public readonly strings: ReadonlyArray<string>,
    public readonly values: SupportedValueType[]
  ) {
    this.queryText = strings.reduce((currText, str, i) => {
      return currText + '$' + i + str;
    });
    this.values = values;
  }

  private getQueryConfig(): QueryConfig {
    return {
      text: this.queryText,
      values: this.values,
    };
  }

  update(): Promise<void> {
    return this.client.query(this.getQueryConfig()).then(() => {});
  }

  async list<T>(deser: SqlDeserializer<T>): Promise<T[]> {
    const { rows } = await this.client.query(this.getQueryConfig());

    return sequenceResult(rows.map((row) => deser.deserialize(row))).getOrThrow();
  }

  async unique<T>(deser: SqlDeserializer<T>): Promise<T | null> {
    const { rows } = await this.client.query(this.getQueryConfig());
    if (rows.length === 0) {
      return null;
    } else {
      return deser.deserialize(rows[0]).getOrThrow();
    }
  }
}
