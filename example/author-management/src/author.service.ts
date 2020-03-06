import { Author, AuthorCreationModel } from './models';
import { createAuthorQuery } from './queries';
import { getPool } from './pool';

export function createAuthor(author: AuthorCreationModel): Promise<Author> {
  return createAuthorQuery(author)
    .map((author) => {
      if (!author) {
        throw new Error(`Author must be created`);
      }
      return author;
    })
    .transact(getPool());
}
