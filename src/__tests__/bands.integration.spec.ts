import { Pool } from 'pg';
import { Sql, SqlConst } from '../query/sql-template-string';
import { deser } from '../deserializer/deserializers';
import { cannotHappen } from '../utils/cannotHappen';
import { SqlDeserializer } from '../deserializer/SqlDeserializer';
import { SqlExecutor } from '../executor/sql-executor';
import { QueryableClient } from '../query/executable-query';

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
  band: Band;
  albums: ReadonlyArray<Album>;
};

type BandWithAlbumsCreate = {
  name: string;
  preferences: object | null;
  albums: ReadonlyArray<{ name: string; releaseDate: Date }>;
};

type BandFilter = { field: 'id'; operator: 'eq'; value: number };

const bandDeser = SqlDeserializer.fromRecord<Band>({
  id: deser.toInteger.forColumn('id'),
  name: deser.toString.forColumn('name'),
  preferences: deser.toJsonObject.orNull().forColumn('preferences'),
});
const albumDeser = SqlDeserializer.fromRecord({
  id: deser.toInteger.orNull().forColumn('album_id'),
  name: deser.toString.orNull().forColumn('album_name'),
  releaseDate: deser.toDate.orNull().forColumn('release_date'),
}).map(({ id, name, releaseDate }) => (id && name && releaseDate ? { id, name, releaseDate } : null));

const bandAndAlbumDeser = SqlDeserializer.fromRecord({
  band: bandDeser,
  album: albumDeser,
});

class BandRepo {
  constructor(private clientGen: QueryableClient) {}

  insertBand(name: string, preferences: object | null): Promise<number> {
    const preferencesValue = preferences ? JSON.stringify(preferences) : null;
    return Sql`INSERT INTO bands(name, preferences) VALUES(${name}, ${preferencesValue}) RETURNING id`
      .unique(deser.toInteger.forColumn('id'))
      .run(this.clientGen);
  }
  linkBandToAlbum(bandId: number, albumId: number): Promise<void> {
    return Sql`INSERT INTO bands_albums(band_id, album_id) VALUES  (${bandId}, ${albumId})`
      .update()
      .run(this.clientGen);
  }

  findBandWithAlbums(filters: Array<BandFilter> = []): Promise<Array<BandWithAlbums>> {
    const clauses =
      filters.length > 0
        ? filters
            .map(({ field, operator, value }) => {
              const op = operator === 'eq' ? SqlConst(` = `) : cannotHappen(operator);
              const fieldConst = SqlConst(field);

              return Sql`b.${fieldConst} ${op} ${value}`;
            })
            .reduce((s1, s2) => Sql`${s1} ${s2}`, Sql` WHERE `)
        : Sql``;
    const sqlQuery = Sql`SELECT b.id, b.name, b.preferences, a.id as album_id, a.name as album_name, a.release_date 
          FROM bands b 
            LEFT JOIN bands_albums ba ON ba.band_id = b.id 
            LEFT JOIN albums a ON a.id = ba.album_id
            ${clauses}`;

    return sqlQuery
      .list(bandAndAlbumDeser)
      .map((arr) => {
        const grouped = arr.reduce<{ [bandId: string]: BandWithAlbums }>((acc, { band, album }) => {
          const bandId = band.id;
          if (!acc[bandId]) {
            acc[bandId] = { band, albums: album ? [album] : [] };
          } else if (album) {
            acc[bandId].albums = [...acc[bandId].albums, album];
          }

          return acc;
        }, {});

        return Object.values(grouped).sort(({ band: band1 }, { band: band2 }) => band1.name.localeCompare(band2.name));
      })
      .run(this.clientGen);
  }
}

class AlbumRepo {
  constructor(private clientGen: QueryableClient) {}

  insertAlbum(name: string, releaseDate: Date): Promise<number> {
    return Sql`INSERT INTO albums(name, release_date) VALUES (${name}, ${releaseDate.toISOString()}) RETURNING id`
      .unique(deser.toInteger.forColumn('id'))
      .run(this.clientGen);
  }
}

class BandService {
  constructor(
    private sqlExecutor: SqlExecutor,
    private bandRepo: (client: QueryableClient) => BandRepo,
    private albumRepo: (client: QueryableClient) => AlbumRepo
  ) {}
  async createBandWithAlbums(
    createModel: BandWithAlbumsCreate
  ): Promise<{ bandId: number; albumIds: ReadonlyArray<number> }> {
    return this.sqlExecutor.transact(async (client) => {
      const bandRepo = this.bandRepo(client);
      const albumRepo = this.albumRepo(client);

      const bandId = await bandRepo.insertBand(createModel.name, createModel.preferences);
      const albumIds = await Promise.all(createModel.albums.map((a) => albumRepo.insertAlbum(a.name, a.releaseDate)));

      await Promise.all(albumIds.map((albumId) => bandRepo.linkBandToAlbum(bandId, albumId)));

      return { bandId, albumIds };
    });
  }

  findBandWithAlbumsById(id: number): Promise<BandWithAlbums | null> {
    return this.sqlExecutor
      .run((client) => this.bandRepo(client).findBandWithAlbums([{ operator: 'eq', field: 'id', value: id }]))
      .then((allBandWithAlbum) => {
        if (allBandWithAlbum.length === 1 || allBandWithAlbum.length === 0) {
          return allBandWithAlbum[0] || null;
        } else {
          throw new Error(`There should be only one band, got ${allBandWithAlbum.length}`);
        }
      });
  }
}

describe('bands integration test', () => {
  let pool: Pool;
  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  });
  afterAll(() => {
    pool.end();
  });

  it('should support initialization and queries without leaking abstraction', async () => {
    const sqlExecutor = SqlExecutor(pool);
    await sqlExecutor.run(
      Sql`CREATE TABLE bands(id SERIAL PRIMARY KEY, name TEXT NOT NULL, preferences JSONB)`.update()
    );
    await sqlExecutor.run(
      Sql`CREATE TABLE albums(id SERIAL PRIMARY KEY, name TEXT NOT NULL, release_date TIMESTAMPTZ NOT NULL)`.update()
    );
    await sqlExecutor.run(
      Sql`CREATE TABLE bands_albums(band_id INTEGER REFERENCES bands(id) NOT NULL, album_id INTEGER REFERENCES albums(id) NOT NULL)`.update()
    );

    const bandService = new BandService(
      sqlExecutor,
      (client) => new BandRepo(client),
      (client) => new AlbumRepo(client)
    );

    const kalisiaAfterCreation = await bandService.createBandWithAlbums({
      name: 'Kalisia',
      preferences: { language: 'France' },
      albums: [{ name: 'Cybion', releaseDate: new Date('2009-01-16T00:00:00Z') }],
    });
    const alcestAfterCreation = await bandService.createBandWithAlbums({
      name: 'Alcest',
      preferences: null,
      albums: [
        { name: 'Kodama', releaseDate: new Date('2016-09-30T00:00:00Z') },
        { name: 'Écailles de Lune', releaseDate: new Date('2010-03-26T00:00:00Z') },
      ],
    });

    expect(kalisiaAfterCreation).toStrictEqual({ bandId: 1, albumIds: [1] });
    expect(alcestAfterCreation).toStrictEqual({ bandId: 2, albumIds: [2, 3] });

    const kalisia = {
      albums: [{ id: 1, name: 'Cybion', releaseDate: new Date('2009-01-16T00:00:00.000Z') }],
      band: { id: 1, name: 'Kalisia', preferences: { language: 'France' } },
    };
    const alcest = {
      albums: [
        { id: 2, name: 'Kodama', releaseDate: new Date('2016-09-30T00:00:00Z') },
        { id: 3, name: 'Écailles de Lune', releaseDate: new Date('2010-03-26T00:00:00Z') },
      ],
      band: { id: 2, name: 'Alcest', preferences: null },
    };

    const queryResult = await bandService.findBandWithAlbumsById(1);
    expect(queryResult).toStrictEqual(kalisia);

    const queryResult2 = await bandService.findBandWithAlbumsById(2);
    expect(queryResult2).toStrictEqual(alcest);

    const queryAllResults = await sqlExecutor.run((client) => new BandRepo(client).findBandWithAlbums());

    expect(queryAllResults).toStrictEqual([alcest, kalisia]);
  });
});
