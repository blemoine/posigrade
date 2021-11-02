Posigrade
====

A library to simplify handling of postgres queries with node. It tries to be in 
the sweet spot between manual queries and ORM.

Posigrade goal
  * queries are written in SQL
  * usage of variables must be simple and secure
  * ensure that once in a transaction, all queries are run in this transaction
  * typesafe: validate that queries returns what their type say they return





Todo
---

* Support du orNull sur les named qui est un peu pourri la
* client.release a appeler manuellemtn => faire le SqlExecutor
* Support des deserializer positionnel ?
* Ajouter fast check pour les test de monad
* Handle the index.ts


----

const client = await pool.connect();
try {
await client.query('BEGIN');

      const result = await this.run(client);

      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }



---------------------------


// base use case ; 

const deserializer: Deser<T>;
SQLExecutor(client).transact(SQL => {
    SQL`SELECT * FROM users WHERE id = 1`.option(dserializer); // Return Promise<T | null>
    SQL`SELECT * FROM users WHERE name ILIKE ${'%test%'}`.list(deserializer); // RETURN Promise<T[]>
    SQL`DELETE FROM users WHERE id = 1`.update() // Return Promise<void>
})

SQLExecutor(client).run(SQL => {
const deserializer: Deser<T>;
    SQL`SELECT * FROM users WHERE id = 1`.option(dserializer); // Return Promise<T | null>
    SQL`SELECT * FROM users WHERE name ILIKE ${'%test%'}`.list(deserializer); // RETURN Promise<T[]>
    SQL`DELETE FROM users WHERE id = 1`.update() // Return Promise<void>
})

// Dynamic query

function getByNameOrId(nameOrId: string | number): Promise<User | null> {
    return SQLExecutor(client).run(SQL => {
            const clause = (typeof nameOrId === 'string')?SQL`name = ${nameOrId}`:SQL`id = ${nameOrId}`

            const visible = true;
            return SQL`SELECT * FROM users WHERE ${clause} AND visible = ${visible}`

    })
}









