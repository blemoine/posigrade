import { QueryConfig } from 'pg';
import { SqlDeserializer } from '../serde/SqlDeserializer';
import { ConnectionIO, mkConnectionIO } from '../connection/ConnectionIO';
import { sequence } from '../result/Result';

export class SqlQuery {
  constructor(public queryConfig: QueryConfig) {}

  list<A>(deserializer: SqlDeserializer<A>): ConnectionIO<Array<A>> {
    return mkConnectionIO((client) => {
      return client.query({ ...this.queryConfig, rowMode: 'array' }).then((queryResult) => {
        return sequence(queryResult.rows.map((row) => deserializer.deserialize(row))).getOrThrow();
      });
    });
  }
}
