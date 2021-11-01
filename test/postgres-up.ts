import { GenericContainer } from 'testcontainers';

module.exports = async function() {
  console.log('Starting Postgres DB');
  const pgContainer = await new GenericContainer('postgres:12')
    .withName('test-postgres')
    .withEnv('POSTGRES_USER', 'test')
    .withEnv('POSTGRES_PASSWORD', 'test')
    .withEnv('POSTGRES_DB', 'test')
    .withExposedPorts(5432)
    .withStartupTimeout(5 * 60 * 1000)
    .start();
  (global as any).__PG_CONTAINER__ = pgContainer;
  process.env.DATABASE_URL = `postgres://test:test@localhost:${pgContainer.getMappedPort(5432)}/test`;

  // waiting to be sure that postgres has started
  await new Promise<void>((resolve) => setTimeout(() => resolve(), 3000));
};
