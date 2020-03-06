import { Author, AuthorCreationModel } from './models';
import { namedDeser, NamedSqlDeserializer, sql } from 'posigrade';

const authorDeserializer: NamedSqlDeserializer<Author> = NamedSqlDeserializer.sequenceDeserRecord({
  id: namedDeser.toInteger,
  name: namedDeser.toString,
  twitter: namedDeser.toString('twitter'),
});

export function createAuthor({ name, twitter }: AuthorCreationModel) {
  return sql`INSERT INTO authors (name, twitter) VALUES (${name}, ${twitter}) RETURNING *`.unique(authorDeserializer);
}
