import { Pool } from 'pg';
import { Sql, SqlConst } from '../query/sql-builder';
import { named } from '../deserializer/deserializers';
import { cannotHappen } from '../utils/cannotHappen';
import { SqlDeserializer } from '../deserializer/SqlDeserializer';
import { SqlExecutor } from '../executor/sql-executor';
import { ExecutableQuery } from '../query/sql-query';

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
  id: named.toInteger.forColumn('id'),
  name: named.toString.forColumn('name'),
  preferences: named.toJsonObject.orNull().forColumn('preferences'),
});
const albumDeser = SqlDeserializer.fromRecord({
  id: named.toInteger.orNull().forColumn('album_id'),
  name: named.toString.orNull().forColumn('album_name'),
  releaseDate: named.toDate.orNull().forColumn('release_date'),
}).map(({ id, name, releaseDate }) => (id && name && releaseDate ? { id, name, releaseDate } : null));

const bandAndAlbumDeser = SqlDeserializer.fromRecord({
  band: bandDeser,
  album: albumDeser,
});

class BandRepo {
  insertBand(name: string, preferences: object | null): ExecutableQuery<number> {
    const preferencesValue = preferences ? JSON.stringify(preferences) : null;
    return Sql`INSERT INTO bands(name, preferences) VALUES(${name}, ${preferencesValue}) RETURNING id`.unique(
      named.toInteger.forColumn('id')
    );
  }
  linkBandToAlbum(bandId: number, albumId: number): ExecutableQuery<void> {
    return Sql`INSERT INTO bands_albums(band_id, album_id) VALUES  (${bandId}, ${albumId})`.update();
  }

  findBandWithAlbums(filters: Array<BandFilter> = []): ExecutableQuery<Array<BandWithAlbums>> {
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

    return sqlQuery.list(bandAndAlbumDeser).map((arr) => {
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
    });
  }
}

class AlbumRepo {
  insertAlbum(name: string, releaseDate: Date): ExecutableQuery<number> {
    return Sql`INSERT INTO albums(name, release_date) VALUES (${name}, ${releaseDate.toISOString()}) RETURNING id`.unique(
      named.toInteger.forColumn('id')
    );
  }
}

class BandService {
  constructor(private sqlExecutor: SqlExecutor, private bandRepo: BandRepo, private albumRepo: AlbumRepo) {}
  async createBandWithAlbums(
    createModel: BandWithAlbumsCreate
  ): Promise<{ bandId: number; albumIds: ReadonlyArray<number> }> {
    return this.sqlExecutor.transact(async (client) => {
      const bandId = await this.bandRepo.insertBand(createModel.name, createModel.preferences).run(client);
      const albumIds = await Promise.all(
        createModel.albums.map((a) => this.albumRepo.insertAlbum(a.name, a.releaseDate).run(client))
      );

      await Promise.all(albumIds.map((albumId) => this.bandRepo.linkBandToAlbum(bandId, albumId).run(client)));

      return { bandId, albumIds };
    });
  }

  findBandWithAlbumsById(id: number): Promise<BandWithAlbums | null> {
    return this.sqlExecutor
      .run(this.bandRepo.findBandWithAlbums([{ operator: 'eq', field: 'id', value: id }]))
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

  it('should support initialization and queries', async () => {
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

    const bandRepo = new BandRepo();
    const albumRepo = new AlbumRepo();
    const bandService = new BandService(sqlExecutor, bandRepo, albumRepo);

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

    const queryAllResults = await sqlExecutor.run(bandRepo.findBandWithAlbums());

    expect(queryAllResults).toStrictEqual([alcest, kalisia]);
  });
});
