import { Pool } from 'pg';
import { SqlExecutor } from '../executor/sql-executor';
import { InferDeserializerType, SqlDeserializer } from '../deserializer/SqlDeserializer';
import { deser } from '../deserializer/deserializers';
import { ExecutableQuery } from '../query/executable-query';
import { Sql } from '../query/sql-template-string';

const gameDeserializer = SqlDeserializer.fromRecord({
  id: deser.toInteger,
  name: deser.toString,
});
type Game = InferDeserializerType<typeof gameDeserializer>;

const gameAndReviewRowDeser = SqlDeserializer.fromRecord({
  id: deser.toInteger,
  name: deser.toString,
  review: SqlDeserializer.fromRecord({
    id: deser.toInteger.orNull().forColumn('review_id'),
    stars: deser.toInteger.orNull(),
    comment: deser.toString.orNull(),
    creationDate: deser.toDate.orNull().forColumn('creation_date'),
  }).map(({ id, stars, comment, creationDate }) =>
    id && stars && creationDate ? { id, stars, comment, creationDate } : null
  ),
});

interface GameAndReviews {
  id: number;
  name: string;
  reviews: { id: number; stars: number; comment: string | null; creationDate: Date }[];
}
function isNotNil<T>(t: T | null | undefined): t is T {
  return t !== null && t !== undefined;
}
class GameRepo {
  addGame(name: string): ExecutableQuery<Game> {
    return Sql`INSERT INTO games(name) VALUES (${name}) RETURNING *`.unique(gameDeserializer);
  }

  findGameAndReviews(gameId: number): ExecutableQuery<GameAndReviews | null> {
    return Sql`SELECT g.id, g.name, 
                      r.id as review_id, r.stars, r.comment, r.creation_date
                 FROM games g
                 LEFT JOIN reviews r ON r.game_id = g.id
                 WHERE g.id = ${gameId}
                 `
      .list(gameAndReviewRowDeser)
      .map((rows) => {
        if (rows.length === 0) {
          return null;
        } else {
          const { id, name } = rows[0];

          return {
            id,
            name,
            reviews: rows.map(({ review }) => review).filter(isNotNil),
          };
        }
      });
  }
}

interface ReviewCreateInput {
  stars: number;
  comment: string | null;
  creationDate: Date | null;
}
const reviewDeserializer = SqlDeserializer.fromRecord({
  id: deser.toInteger,
  stars: deser.toInteger,
  comment: deser.toString.orNull(),
  creationDate: deser.toDate.forColumn('creation_date'),
  gameId: deser.toInteger.forColumn('game_id'),
});

type Review = InferDeserializerType<typeof reviewDeserializer>;
class ReviewRepo {
  addReview(gameId: number, { stars, creationDate, comment }: ReviewCreateInput): ExecutableQuery<Review> {
    return Sql`INSERT INTO reviews(game_id, stars, comment, creation_date) 
                         VALUES (${gameId}, ${stars}, ${comment}, ${creationDate || new Date()})
                         RETURNING *`.unique(reviewDeserializer);
  }
}

class GameService {
  constructor(private sqlExecutor: SqlExecutor, private gameRepo: GameRepo, private reviewRepo: ReviewRepo) {}
  addGameAndReviews(gameName: string, reviews: ReviewCreateInput[]): Promise<GameAndReviews> {
    return this.sqlExecutor.transact(async (client) => {
      const game = await this.gameRepo.addGame(gameName).run(client);
      const reviewsForGame = await Promise.all(reviews.map((r) => this.reviewRepo.addReview(game.id, r).run(client)));

      return {
        ...game,
        reviews: reviewsForGame.map(({ stars, comment, creationDate, id }) => {
          //Remove unwanted properties
          return { stars, comment, creationDate, id };
        }),
      };
    });
  }

  findGameAndReview(gameId: number): Promise<GameAndReviews | null> {
    return this.sqlExecutor.run(this.gameRepo.findGameAndReviews(gameId));
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

  it('should support initialization in query in more straightforward manner', async () => {
    const sqlExecutor = SqlExecutor(pool);

    const createGamesTable = Sql`CREATE TABLE games(id SERIAL PRIMARY KEY, name TEXT NOT NULL)`.update();
    const createReviewsTable = Sql`CREATE TABLE reviews(
               id SERIAL PRIMARY KEY, 
               game_id INTEGER REFERENCES games(id) NOT NULL,
               stars INTEGER NOT NULL, 
               comment TEXT DEFAULT NULL, 
               creation_date TIMESTAMPTZ NOT NULL
                    )`.update();

    await sqlExecutor.run(createGamesTable.andThen(createReviewsTable));

    const gameRepo = new GameRepo();
    const reviewRepo = new ReviewRepo();
    const gameService = new GameService(sqlExecutor, gameRepo, reviewRepo);

    const darkSouls = await gameService.addGameAndReviews('Dark Souls', []);
    const bloodborne = await gameService.addGameAndReviews('Bloodborne', [
      { comment: null, creationDate: null, stars: 5 },
      { comment: 'it is too hard', creationDate: null, stars: 3 },
    ]);

    expect(darkSouls.reviews).toHaveLength(0);
    expect(bloodborne.reviews).toHaveLength(2);
    await expect(gameService.findGameAndReview(darkSouls.id)).resolves.toStrictEqual(darkSouls);
    await expect(gameService.findGameAndReview(bloodborne.id)).resolves.toStrictEqual(bloodborne);
  });
});
