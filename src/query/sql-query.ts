import { QueryArrayResult, QueryConfig } from 'pg';
import { SqlDeserializer } from '../serde/SqlDeserializer';
import { ConnectionIO } from '../connection/ConnectionIO';
import { sequence } from '../result/Result';

function mkConnectionIO(queryConfig: QueryConfig): ConnectionIO<QueryArrayResult> {
  return new ConnectionIO((client) => {
    return client.query({ ...queryConfig, rowMode: 'array' });
  });
}

export class SqlQuery {
  constructor(public queryConfig: QueryConfig) {}

  list<A>(deserializer: SqlDeserializer<A>): ConnectionIO<Array<A>> {
    return mkConnectionIO(this.queryConfig).map(({ rows }) => {
      return sequence(rows.map((row) => deserializer.deserialize(row))).getOrThrow();
    });
  }

  unique<A>(deserializer: SqlDeserializer<A>): ConnectionIO<A> {
    return mkConnectionIO(this.queryConfig).map(({ rows }) => {
      if (rows.length !== 1) {
        throw new Error(`Query ${this.queryConfig.text} returns more than one row`);
      }
      return deserializer.deserialize(rows[0]).getOrThrow();
    });
  }

  update(): ConnectionIO<void> {
    return mkConnectionIO(this.queryConfig).map(() => {});
  }
}
