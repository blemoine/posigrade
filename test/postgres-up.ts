import { GenericContainer } from 'testcontainers';
import { Duration, TemporalUnit } from 'node-duration';

module.exports = async function() {
  console.log('Starting Postgres DB');
  const pgContainer = await new GenericContainer('postgres', '12')
    .withName('test-postgres')
    .withEnv('POSTGRES_USER', 'test')
    .withEnv('POSTGRES_PASSWORD', 'test')
    .withEnv('POSTGRES_DB', 'test')
    .withExposedPorts(5432)
    .withStartupTimeout(new Duration(300, TemporalUnit.SECONDS))
    .start();
  (global as any).__PG_CONTAINER__ = pgContainer;
  process.env.DATABASE_URL = `postgres://test:test@localhost:${pgContainer.getMappedPort(5432)}/test`;

  // waiting to be sure that postgres has started
  await new Promise((resolve) => setTimeout(() => resolve(), 3000));
};
