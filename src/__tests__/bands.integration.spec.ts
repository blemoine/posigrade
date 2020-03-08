import { Pool } from 'pg';
import { sql } from '../query/sql-parser';
import { ConnectionIO, deser, PositionSqlDeserializer } from '..';

type Band = {
  id: number;
  name: string;
  preferences: object | null;
};
type Album = {
  id: number;
  name: string;
  releaseDate: Date;
};
type BandWithAlbums = {
  author: Band;
  albums: ReadonlyArray<Album>;
};

type BandWithAlbumsCreate = {
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

function findBandWithAlbumsById(id: number): ConnectionIO<BandWithAlbums | null> {
  return sql`
        SELECT b.id, b.name, b.preferences, a.id, a.name, a.release_date 
        FROM bands b 
          LEFT JOIN bands_albums ba ON ba.band_id = b.id 
          LEFT JOIN albums a ON a.id = ba.album_id 
        WHERE b.id = ${id}`
    .list(
      PositionSqlDeserializer.sequenceDeser(
        deser.toInteger,
        deser.toString,
        deser.toJsonObject.orNull(),
        deser.toInteger,
        deser.toString,
        deser.toDate
      )
    )
    .map((arr: Array<[number, string, object | null, number, string, Date]>) => {
      const grouped = arr.reduce<{ [bandId: string]: BandWithAlbums }>(
        (acc, [bandId, bandName, preferences, albumId, albumName, releaseDate]) => {
          const album = { id: albumId, name: albumName, releaseDate };
          if (!acc[bandId]) {
            acc[bandId] = {
              author: { id: bandId, name: bandName, preferences },
              albums: [album],
            };
          } else {
            acc[bandId].albums = [...acc[bandId].albums, album];
          }

          return acc;
        },
        {}
      );

      const allBandWithAlbum = Object.values(grouped);

      if (allBandWithAlbum.length === 1 || allBandWithAlbum.length === 0) {
        return allBandWithAlbum[0] || null;
      } else {
        throw new Error(`There should be only one band, got ${allBandWithAlbum.length}`);
      }
    });
}

function createBandWithAlbums(
  createModel: BandWithAlbumsCreate
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

  test('it should support the initialization of bands table', async () => {
    await sql`CREATE TABLE bands(id SERIAL PRIMARY KEY, name TEXT NOT NULL, preferences JSONB)`
      .update()
      .andThen(
        sql`CREATE TABLE albums(id SERIAL PRIMARY KEY, name TEXT NOT NULL, release_date TIMESTAMPTZ NOT NULL)`.update()
      )
      .andThen(
        sql`CREATE TABLE bands_albums(band_id INTEGER REFERENCES bands(id) NOT NULL, album_id INTEGER REFERENCES albums(id) NOT NULL)`.update()
      )
      .transact(pool);

    const creationResult = await ConnectionIO.sequence([
      createBandWithAlbums({
        name: 'Kalisia',
        preferences: { language: 'France' },
        albums: [{ name: 'Cybion', releaseDate: new Date('2009-01-16T00:00:00Z') }],
      }),
      createBandWithAlbums({
        name: 'Alcest',
        preferences: null,
        albums: [
          { name: 'Kodama', releaseDate: new Date('2016-09-30T00:00:00Z') },
          { name: 'Écailles de Lune', releaseDate: new Date('2010-03-26T00:00:00Z') },
        ],
      }),
    ]).transact(pool);

    expect(creationResult).toStrictEqual([
      { bandId: 1, albumIds: [1] },
      { bandId: 2, albumIds: [2, 3] },
    ]);

    const queryResult = await findBandWithAlbumsById(1).transact(pool);

    expect(queryResult).toStrictEqual({
      albums: [{ id: 1, name: 'Cybion', releaseDate: new Date('2009-01-16T00:00:00.000Z') }],
      author: { id: 1, name: 'Kalisia', preferences: { language: 'France' } },
    });

    const queryResult2 = await findBandWithAlbumsById(2).transact(pool);

    expect(queryResult2).toStrictEqual({
      albums: [
        { id: 2, name: 'Kodama', releaseDate: new Date('2016-09-30T00:00:00Z') },
        { id: 3, name: 'Écailles de Lune', releaseDate: new Date('2010-03-26T00:00:00Z') },
      ],
      author: { id: 2, name: 'Alcest', preferences: null },
    });
  });
});
