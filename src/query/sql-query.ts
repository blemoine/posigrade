import { ClientBase, QueryConfig } from 'pg';
import { SqlDeserializer } from '../deserializer/SqlDeserializer';
import { sequenceResult } from '../result/Result';
import { NonEmptyArray } from '../utils/non-empty-array';
import { ExecutableQuery } from './executable-query';

export type BaseSupportedValueType = string | number | boolean | Date | null;
export type SupportedValueType = BaseSupportedValueType | Array<BaseSupportedValueType>;

export class SqlQuery {
  public readonly queryText: string;
  constructor(public readonly strings: NonEmptyArray<string>, public readonly values: SupportedValueType[]) {
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

  update(): ExecutableQuery<void> {
    return new ExecutableQuery((client) => client.query(this.getQueryConfig()).then(() => {}));
  }

  list<T>(deser: SqlDeserializer<T>): ExecutableQuery<T[]> {
    return new ExecutableQuery(async (client) => {
      const { rows } = await client.query(this.getQueryConfig());

      return sequenceResult(rows.map((row) => deser.deserialize(row))).getOrThrow();
    });
  }

  option<T>(deser: SqlDeserializer<T>): ExecutableQuery<T | null> {
    return new ExecutableQuery(async (client) => {
      const { rows } = await client.query(this.getQueryConfig());
      if (rows.length === 0) {
        return null;
      } else {
        return deser.deserialize(rows[0]).getOrThrow();
      }
    });
  }

  unique<T>(deser: SqlDeserializer<T>): ExecutableQuery<T> {
    return new ExecutableQuery(async (client) => {
      const queryConfig = this.getQueryConfig();
      const { rows } = await client.query(queryConfig);
      if (rows.length === 0) {
        throw new Error(`No row returned for query ${queryConfig.text}`);
      } else {
        return deser.deserialize(rows[0]).getOrThrow();
      }
    });
  }
}
