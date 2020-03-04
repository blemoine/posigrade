import { QueryArrayResult, QueryConfig, QueryResult } from 'pg';
import { SqlDeserializer } from '../serde/SqlDeserializer';
import { ConnectionIO } from '../connection/ConnectionIO';
import { sequence } from '../result/Result';

function mkConnectionIO(
  queryConfig: QueryConfig,
  rowMode: 'array' | 'object'
): ConnectionIO<QueryArrayResult | QueryResult> {
  return new ConnectionIO((client) => {
    return client.query({ ...queryConfig, ...(rowMode === 'array' ? { rowMode } : {}) }).catch((err) => {
      throw new Error(`Error on query '${queryConfig.text}': '${err.message}'`);
    });
  });
}

export class SqlQuery {
  constructor(public queryConfig: QueryConfig) {}

  list<A>(deserializer: SqlDeserializer<A>): ConnectionIO<Array<A>> {
    return mkConnectionIO(this.queryConfig, deserializer.rowMode).map(({ rows }) => {
      return sequence<A>((rows as any[]).map((row) => deserializer.deserialize(row))).getOrThrow();
    });
  }

  unique<A>(deserializer: SqlDeserializer<A>): ConnectionIO<A | null> {
    return mkConnectionIO(this.queryConfig, deserializer.rowMode).map(({ rows }) => {
      if (rows.length > 1) {
        throw new Error(`Query ${this.queryConfig.text} returns more than one row`);
      }
      if (rows.length === 0) {
        return null;
      }
      return deserializer.deserialize(rows[0]).getOrThrow();
    });
  }

  update(): ConnectionIO<void> {
    return mkConnectionIO(this.queryConfig, 'array').map(() => {});
  }
}
