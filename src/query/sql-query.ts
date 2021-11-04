import { QueryConfig } from 'pg';
import { SqlDeserializer } from '../deserializer/SqlDeserializer';
import { sequenceResult } from '../result/Result';
import { NonEmptyArray } from '../utils/non-empty-array';
import { ExecutableQuery } from './executable-query';

export type BaseSupportedValueType = string | number | boolean | Date | null;
export type SupportedValueType = BaseSupportedValueType | Array<BaseSupportedValueType>;

/**
 *  Represent a query text with its companion dynamic values.
 *  For example `SELECT * FROM table WHERE id = $1` and `['123']`.
 *
 *  The main usage of this class is to be transformed to an ExecutableQuery when passing a deserializer.
 *  The deserializer ensure that the results of the query is well typed, and will throw en error if there is an error.
 *
 *  To create an instance of this class, we will usually use `Sql` template string instead of the constructor.
 *
 *  @example
 *
 * ```
 * const name = '123';
 * const query: SqlQuery = SQL`SELECT id, name FROM users WHERE name = ${name}`;
 *
 * const deserializer = SqlDeserializer.fromRecord({
 *   id: deser.toInteger,  // Will use `id` for column name
 *   name: deser.toString.forColumn('another_col'), // will use 'another_col' for column name
 * });
 * type User = InferDeserializerType<typeof deserializer>;
 *
 * query.list(deser) // Hold an ExecutableQuery<User[]>
 *
 * query.unique(deser) // Hold an ExecutableQuery<User>, that will fail when executed if no rows are returned
 *
 * query.option(deser) // Hold an ExecutableQuery<User | null>
 *
 * ```
 */
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

  /**
   * Create an ExecutableQuery that will ignore the any rows returned by postgres
   */
  update(): ExecutableQuery<void> {
    return new ExecutableQuery((client) => client.query(this.getQueryConfig()).then(() => {}));
  }

  /**
   * Create an ExecutableQuery that will return a deserialized value for each row returned by postgres
   *
   * @param deser - the deserializer used by each rows
   */
  list<T>(deser: SqlDeserializer<T>): ExecutableQuery<T[]> {
    return new ExecutableQuery(async (client) => {
      const { rows } = await client.query(this.getQueryConfig());

      return sequenceResult(rows.map((row) => deser.deserialize(row))).getOrThrow();
    });
  }

  /**
   * Create an ExecutableQuery that will return a deserialized row if there is one, null if there is no row,
   * or throw an error if there is more than one row
   *
   * @param deser - the deserializer used by the row
   */
  option<T>(deser: SqlDeserializer<T>): ExecutableQuery<T | null> {
    return new ExecutableQuery(async (client) => {
      const queryConfig = this.getQueryConfig();
      const { rows } = await client.query(queryConfig);
      if (rows.length === 0) {
        return null;
      } else if (rows.length === 1) {
        return deser.deserialize(rows[0]).getOrThrow();
      } else {
        throw new Error(`More than one row were returned for query ${queryConfig.text}`);
      }
    });
  }

  /**
   * Create an ExecutableQuery that will return a deserialized row if there is one, or throw an error if there is no row or more than one row
   *
   * @param deser - the deserializer used by the row
   */
  unique<T>(deser: SqlDeserializer<T>): ExecutableQuery<T> {
    return new ExecutableQuery(async (client) => {
      const queryConfig = this.getQueryConfig();
      const { rows } = await client.query(queryConfig);
      if (rows.length === 0) {
        throw new Error(`No row returned for query ${queryConfig.text}`);
      } else if (rows.length === 1) {
        return deser.deserialize(rows[0]).getOrThrow();
      } else {
        throw new Error(`More than one row were returned for query ${queryConfig.text}`);
      }
    });
  }
}
