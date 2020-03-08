import { Pool } from 'pg';
import { sql } from '../query/sql-parser';
import { ConnectionIO, deser } from '..';

/*
type Author = {
  id: number;
  name: string;
  preferences: object | null;
};
type Album = {
  id: number;
  name: string;
  releaseDate: Date;
};
type AuthorWithAlbums = {
  author: Author;
  albums: ReadonlyArray<Album>;
};
*/
type AuthorWithAlbumsCreate = {
  name: string;
  preferences: object | null;
  albums: ReadonlyArray<{ name: string; releaseDate: Date }>;
};

function insertBand(name: string, preferences: object | null): ConnectionIO<number> {
  const preferencesValue = preferences ? JSON.stringify(preferences) : null;
  return sql`INSERT INTO bands(name, preferences) VALUES(${name}, ${preferencesValue}) RETURNING id`.strictUnique(
    deser.toInteger
  );
}

function insertAlbum(name: string, releaseDate: Date): ConnectionIO<number> {
  return sql`INSERT INTO albums(name, release_date) VALUES (${name}, ${releaseDate.toISOString()}) RETURNING id`.strictUnique(
    deser.toInteger
  );
}

function createAuthorWithAlbums(
  createModel: AuthorWithAlbumsCreate
): ConnectionIO<{ bandId: number; albumIds: ReadonlyArray<number> }> {
  const { name, preferences, albums } = createModel;

  return insertBand(name, preferences).flatMap((bandId) =>
    ConnectionIO.sequence(
      albums.map(({ name, releaseDate }) =>
        insertAlbum(name, releaseDate).flatMap((albumId) =>
          sql`INSERT INTO bands_albums(band_id, album_id) VALUES(${bandId}, ${albumId})`
            .update()
            .andThen(ConnectionIO.of(albumId))
        )
      )
    ).map((albumIds) => ({ bandId, albumIds }))
  );
}

describe('sql-query', () => {
  let pool: Pool;
  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  });
  afterAll(() => {
    pool.end();
  });

  test('it should support the initialization of authors table', async () => {
    await sql`CREATE TABLE bands(id SERIAL PRIMARY KEY, name TEXT NOT NULL, preferences JSONB)`
      .update()
      .andThen(
        sql`CREATE TABLE albums(id SERIAL PRIMARY KEY, name TEXT NOT NULL, release_date TIMESTAMPTZ NOT NULL)`.update()
      )
      .andThen(
        sql`CREATE TABLE bands_albums(band_id INTEGER REFERENCES bands(id) NOT NULL, album_id INTEGER REFERENCES albums(id) NOT NULL)`.update()
      )
      .transact(pool);

    const result = await ConnectionIO.sequence([
      createAuthorWithAlbums({
        name: 'Kalisia',
        preferences: { language: 'France' },
        albums: [{ name: 'Cybion', releaseDate: new Date('2009-01-16T00:00:00Z') }],
      }),
      createAuthorWithAlbums({
        name: 'Alcest',
        preferences: null,
        albums: [
          { name: 'Kodama', releaseDate: new Date('2016-09-30T00:00:00Z') },
          { name: 'Écailles de Lune', releaseDate: new Date('2010-03-26T00:00:00Z') },
        ],
      }),
    ]).transact(pool);

    expect(result).toStrictEqual([
      { bandId: 1, albumIds: [1] },
      { bandId: 2, albumIds: [2, 3] },
    ]);
  });
});
