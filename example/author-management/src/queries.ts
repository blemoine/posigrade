import { Author, AuthorCreationModel } from './models';
import { ConnectionIO, namedDeser, NamedSqlDeserializer, sql } from 'posigrade';

const authorDeserializer: NamedSqlDeserializer<Author> = NamedSqlDeserializer.sequenceDeserRecord({
  id: namedDeser.toInteger,
  name: namedDeser.toString,
  twitter: namedDeser.toString('twitter').or(namedDeser.toNull('twitter')),
});

export function createAuthorQuery({ name, twitter }: AuthorCreationModel): ConnectionIO<Author | null> {
  return sql`INSERT INTO authors (name, twitter) VALUES (${name}, ${twitter}) RETURNING *`.unique(authorDeserializer);
}
