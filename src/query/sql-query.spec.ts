import { Sql } from './sql-template-string';
import { QueryableClient } from './executable-query';
import { SqlExecutionError } from './sql-query';
import { RowObject, SqlDeserializer } from '../deserializer/SqlDeserializer';

describe('SqlQuery', () => {
  const fakeClient = (rows: RowObject[]): QueryableClient => ({
    query: (): any => Promise.resolve({ rows }),
  });
  const fakeFailedClient: QueryableClient = {
    query: (): any => Promise.reject(new Error('expected error')),
  };

  describe('queryText', () => {
    it('should display an aggregated text value', () => {
      const query = Sql`SELECT ${1} FROM users WHERE id = ${'test'}`;

      expect(query.queryText).toStrictEqual('SELECT $1 FROM users WHERE id = $2');
    });
  });

  describe('update', () => {
    it('should execute the code and return nothing', async () => {
      const executableQuery = Sql`SELECT 1`.update();

      const result = await executableQuery.run(fakeClient([]));
      expect(result).toBe(undefined);
    });

    it('should throw an error if there is one', () => {
      const executableQuery = Sql`SELECT 1`.update();

      const result = executableQuery.run(fakeFailedClient);
      return expect(result).rejects.toStrictEqual(
        new SqlExecutionError(`Got "expected error" on query "SELECT 1"`, new Error('expected error'))
      );
    });
  });

  describe('list', () => {
    it('should execute the code and return deserialized list', async () => {
      const executableQuery = Sql`SELECT 1`.list(SqlDeserializer.of(1));

      const result = await executableQuery.run(fakeClient([{}, {}]));
      expect(result).toStrictEqual([1, 1]);
    });

    it('should throw an error if there is one', () => {
      const executableQuery = Sql`SELECT 1`.list(SqlDeserializer.of(1));

      const result = executableQuery.run(fakeFailedClient);
      return expect(result).rejects.toStrictEqual(
        new SqlExecutionError(`Got "expected error" on query "SELECT 1"`, new Error('expected error'))
      );
    });
  });

  describe('unique', () => {
    it('should execute the code and return deserialized element if there one', async () => {
      const executableQuery = Sql`SELECT 1`.unique(SqlDeserializer.of(1));

      const result = await executableQuery.run(fakeClient([{}]));
      expect(result).toStrictEqual(1);
    });
    it('should execute the code and return an error if there is no element', async () => {
      const executableQuery = Sql`SELECT 1`.unique(SqlDeserializer.of(1));

      const result = executableQuery.run(fakeClient([]));
      return expect(result).rejects.toStrictEqual(new Error(`No row returned for query "SELECT 1"`));
    });

    it('should execute the code and return an error if there is more than one element', async () => {
      const executableQuery = Sql`SELECT 1`.unique(SqlDeserializer.of(1));

      const result = executableQuery.run(fakeClient([{}, {}]));
      return expect(result).rejects.toStrictEqual(new Error(`More than one row were returned for query "SELECT 1"`));
    });

    it('should throw an error if there is one', () => {
      const executableQuery = Sql`SELECT 1`.unique(SqlDeserializer.of(1));

      const result = executableQuery.run(fakeFailedClient);
      return expect(result).rejects.toStrictEqual(
        new SqlExecutionError(`Got "expected error" on query "SELECT 1"`, new Error('expected error'))
      );
    });
  });

  describe('option', () => {
    it('should execute the code and return deserialized element if there one', async () => {
      const executableQuery = Sql`SELECT 1`.option(SqlDeserializer.of(1));

      const result = await executableQuery.run(fakeClient([{}]));
      expect(result).toStrictEqual(1);
    });
    it('should execute the code and return null if there is no element', async () => {
      const executableQuery = Sql`SELECT 1`.option(SqlDeserializer.of(1));

      const result = await executableQuery.run(fakeClient([]));
      expect(result).toStrictEqual(null);
    });

    it('should execute the code and return an error if there is more than one element', async () => {
      const executableQuery = Sql`SELECT 1`.option(SqlDeserializer.of(1));

      const result = executableQuery.run(fakeClient([{}, {}]));
      return expect(result).rejects.toStrictEqual(new Error(`More than one row were returned for query "SELECT 1"`));
    });

    it('should throw an error if there is one', () => {
      const executableQuery = Sql`SELECT 1`.option(SqlDeserializer.of(1));

      const result = executableQuery.run(fakeFailedClient);
      return expect(result).rejects.toStrictEqual(
        new SqlExecutionError(`Got "expected error" on query "SELECT 1"`, new Error('expected error'))
      );
    });
  });
});
