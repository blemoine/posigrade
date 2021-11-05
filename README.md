# Posigrade

A library to simplify handling of postgres queries with node. It tries to be in
the sweet spot between manual queries and ORM.

Posigrade goal:

- queries are written in SQL: Posigrade is not an ORM;
- usage of variables must be simple and secure: Posigrade prevents SQL Injection by default;
- ensure that once in a transaction, all queries are run in this transaction
- typesafe: validate that queries returns what their type say they return

## Quickstart

Install posigrade
`npm i posigrade` OR `yarn add posigrade`

Create a connection pool in your code as you would do with the [node postgres driver](https://node-postgres.com/)

```ts
import { Pool } from 'pg';
const pool = new Pool(); // cf node-postgres doc for more information
```

With this pool you can create an SqlExecutor, that will simplify transaction handling

```ts
const sqlExecutor = SqlExecutor(pool);
```

Now you can define you deserializers, that will ensure the type safety of what you're doing

```ts
type User = { id: number; name: string };
const userDeserializer = SqlDeserializer.fromRecord<User>({
  id: deser.toInteger,
  name: deser.toString,
});
```

You can now use posigrade to query the database as you want:

```ts
// in a direct run
await sqlExecutor.run(
  Sql`CREATE TABLE users(id SERIAL PRIMARY KEY, name TEXT NOT NULL)`.update()
);

// or in a transaction
const users: User[] = await sqlExecutor.transact(async (client) => {
    const names = ['georges', 'peter' ,'steven']

    const insertionQuery = (name:string) => Sql`INSERT INTO users(name) VALUES ${name}`.update();
    await Promise.all(names.map(name => insertionQuery(name).run(client));


    const users = Sql`SELECT id, name FROM users`.list(userDeserializer).run(client);


    return users;
});

// users contains `[{id:1, name: 'georges'},{id:2, name: 'peter'},{id:3, name: 'steven'}]`
```

## Conceptual overview

Posigrade is wrapper around a chain of function calls leading to the result of an SQL query.

```
Sql string template --> SqlQuery ---+
                                    |
SqlDeserializer<T> -----------------+-> ExecutableQuery<T> ---+
                                                              |
SqlExecutor --------------> QueryableClient ------------------+----> Promise<T>
```

So you'll need 3 objects for everything to work:

- an `SqlExecutor` which represent a connection to a database
- some `SqlDeserializer<T>` that will ensure the typesafe transformation of the rows to something useful
- an `SqlQuery` which is essentially an... SQL query.

### SqlExecutor

It's a wrapper around the connection pool of the [node postgres driver](https://node-postgres.com/);
Please look at the driver to understand how to configure the connection pool.
Getting the executor from the pool can be done with:

```ts
import { Pool } from 'pg';
const pool = new Pool(); // cf node-postgres doc for more information

const sqlExecutor = SqlExecutor(pool);
```

The SqlExecutor let you run your queries in 2 "modes":

- directly
- in a transaction

#### Direct run

Call the `run` method. The input parameter is a callback taking the postgres client in parameter.

```ts
// Returns Promise<number[]>
sqlExecutor.run((client) => SQL`SELECT id FROM my_table`.list(deser.toInteger.forColumn('id')).run(client));
```

To simplify things, it can also take an `ExecutableQuery<T>`

```ts
// Returns Promise<number[]>
sqlExecutor.run(SQL`SELECT id FROM my_table`.list(deser.toInteger.forColumn('id')));
```

#### Transaction run

Works like the `run` method, but everything executed on the client will be done on a transaction, meaning that
if any `Error` is thrown in the callback, all changes done will be rollbacked.

```ts
// Returns Promise<number[]>
sqlExecutor.transact((client) => {
  SQL`INSERT INTO my_table(id) VALUES ${1}`.update().run(client);
  SQL`INSERT INTO my_table(id) VALUES ${2}`.update().run(client);
});
```

### SqlDeserializer

It transforms a row (which is essentially an object with unknown properties/values) to a known and well-typed object.

Simple deserializers can be used:

```ts
const idDeserializer: SqlDeserializer<number> = deser.toInteger.forColumn('id');

SQL`SELECT id FROM my_table`.list(idDeserializer); // deserialize to numnber[]
```

If something may be nullable, it should be explicit in the SqlDeserializer

```ts
const nameDeserializer: SqlDeserializer<string | null> = deser.toString.orNull().forColumn('name');

SQL`SELECT name FROM my_table`.list(nameDeserializer); // deserialize to (string | null)[]
```

If you want to get a richer type, you can transform the result type of the serializer with `map`

```ts
const nameDeserializer: SqlDeserializer<string | null> = deser.toString.map((name) => ({ name })).forColumn('name');

SQL`SELECT name FROM my_table`.list(nameDeserializer); // deserialize to ({name:string})[]
```

Finally, to get a more complex type, we can combine serializers

```ts
const userDeser = SqlDeserializer.fromRecord({
  id: deser.toInteger, // if you don't specify a column name, it will take the object key for column name
  name: deser.toString,
  creationDate: deser.toDate.forColumn('creation_date'),
});

SQL`SELECT id, name, creation_date FROM users`.list(userDeser); // deserializer to ({id:number, name:string, creationDate: Date})[]
```

You can explicitly set the type expected from a deserializer (and TS will check that you deserializer returns correctly the expected type)

```ts
type User = { id: number; name: string };
const userDeser = SqlDeserializer.fromRecord<User>({
  id: deser.toInteger,
  name: deser.toString,
});
```

Or you can define your type _from_ your deserializer

```ts
const userDeserializer = SqlDeserializer.fromRecord({
  id: deser.toInteger,
  name: deser.toString,
});

// will hold {id:number, name:string}
type User = InferDeserializerType<typeof userDeserializer>;
```

### SqlQuery

A `SqlQuery` is built from an SQL template string. It will automatically pass the variables as parameters to postgres
to prevent any attempt of SQL Injection

```ts
function findNameById(id: string): ExecutableQuery<string> {
  return Sql`SELECT name FROM users WHERE id = ${id}`.unique(deser.toString.forColumn('name'));
}
```

You can build queries with dynamic part by wrapping the dynamic parts in `Sql`:

```ts
function findAllName(sortByName: boolean): ExecutableQuery<string[]> {
  const orderBy = sortByName ? Sql`ORDER BY name` : Sql``;
  return Sql`SELECT name FROM users ${orderBy}`.list(deser.toString.forColumn('name'));
}
```

If you need a variable that is not a query parameter, but that cannot be known at compile time, you can use `SqlConst`.
/!\ This is dangerous, as it can be susceptible to SQL Injections. Refrain to use this feature if you can, and never use
it with a non sanitized user input.

```ts
function findAllName(fieldToSelect: 'firstName' | 'lastName'): ExecutableQuery<string[]> {
  return Sql`SELECT ${SqlConst(fieldToSelect)} FROM users`.list(deser.toString.forColumn('name'));
}
```

## FAQ

### How to write a `IN` operator with an array variable?

Short answer: use `ANY`

```ts
function findNamesByIds(ids: number[]): ExecutableQuery<string[]> {
  return Sql`SELECT name FROM users WHERE id = ANY(${ids})`.list(deser.toString.forColumn('name'));
}
```

### How to build your own deserializer?

If mapping and combinators are not enough for your need, you can build a deserializer by yourself:

#### Simple deserializers

Use `DeserDefintion`:

```ts
const stringStartingWithA: DeserDefinition<string> = {
  guard: (value): value is string => typeof value === 'string' && value.startsWith('a'),
  errorMessage: (value) => `'${value}' is not a string starting with 'a'`,
};

const myCustomDeser = toNamedDeserializer(stringStartingWithA);
```

#### Advanced deserializers:

If you want things to be safe, return a `Failure` when the Deserializer should not work.

```ts
const myCustomDeser: NamedDeserializer<{ name: string }> = new NamedDeserializer(
  (col: string) =>
    new SqlDeserializer((row: RowObject) => {
      if (!Object.prototype.hasOwnProperty.call(row, col)) {
        throw new Error(`No column named '${col}' exists in the list of cols '${Object.keys(row).join(', ')}'`);
      }
      const value = row[col];
      if (typeof value === 'string') {
        return Success.of({ name: value });
      } else {
        return Failure.raise(`The value in col '${col}' is not a string`);
      }
    })
);
```

## Architecture suggestion

Software architecture is not a question with an objective answer, and the followings are only suggestion, that may
or may not apply to your case.

Our model will be the same in the 2 cases

```ts
// user.model.ts
type User = {
  id: number;
  name: string;
};
```

### Straightforward architecture

Here we don't care that posigrade leaks in our types/classes. It's a commitment to posigrade, as it means it would
make it hard to use another library instead. That being said, it's also a very simple architecture, both to understand
AND to test.

First we define our model

Then we define our repository, responsible for creating the queries

```ts
const userDeser = SqlDeserializer.fromRecord<User>({
  id: deser.toInteger,
  name: deser.toString,
});
class UserRepo {
  createUser({ name }: { name: string }): ExecutableQuery<User> {
    return Sql`INSERT INTO users(name) VALUES ${name} RETURNING *`.unique(userDeser);
  }
  findUserById(id: number): ExecutableQuery<User | null> {
    return Sql`SELECT * FROM users WHERE id = ${id}`.option(userDeser);
  }
  findAll(): ExecutableQuery<User[]> {
    return Sql`SELECT * FROM users`.list(userDeser);
  }
}
```

Finally, we define the service, responsible to executing the queries

```ts
class UserService {
  constructor(private sqlExecutor: SqlExecutor, private userRepo: UserRepo) {}

  createUser(payload: { name: string }): Promise<User> {
    return sqlExecutor.run(this.userRepo.createUser(payload));
  }
  findUserById(id: number): Promise<User | null> {
    return sqlExecutor.run(this.userRepo.findUserById(id));
  }
  findAll(): Promise<User[]> {
    return sqlExecutor.run(this.userRepo.findAll());
  }
}
```

The repository is not really unit testable: the core of the functions are strings, the queries, that can contain
syntax errors, not return what you expect, etc.
So I would suggest to test the repository against a real database,
with [testcontainers](https://www.npmjs.com/package/testcontainers) for example

The service can be easily tested by faking the Executor and the repo:

```ts
const fakeClient: QueryableClient = {
  query: (): any => ({
    rows: [],
  }),
};
const fakeExecutor: SqlExecutor = {
  async run<T>(fn: ExecutableQuery<T> | ((client: QueryableClient) => Promise<T>)): Promise<T> {
    if (fn instanceof ExecutableQuery) {
      return fn.run(fakeClient);
    } else {
      return fn(fakeClient);
    }
  },
  async transact<T>(fn: ExecutableQuery<T> | ((client: QueryableClient) => Promise<T>)): Promise<T> {
    if (fn instanceof ExecutableQuery) {
      return fn.run(fakeClient);
    } else {
      return fn(fakeClient);
    }
  },
};
const fakeRepo = {
  createUser({ name }: { name: string }): ExecutableQuery<User> {
    return ExecutableQuery.of({ id: 1, name: 'georges' });
  },
  findUserById(id: number): ExecutableQuery<User | null> {
    return ExecutableQuery.of(null);
  },
  findAll(): ExecutableQuery<User[]> {
    return ExecutableQuery.of([{ id: 1, name: 'georges' }]);
  },
};
const userServiceUnderTest = new UserService(fakeExecutor, fakeRepo);
```

### Seamless architecture

Here the goal is for posigrade to not be "visible" from the interface point of view, leading to easier revertability.
But the code is also less straightforward for it

Then we define our repository, responsible for creating the queries, but here we _wants_ the method to return Promise directly

```ts
const userDeser = SqlDeserializer.fromRecord<User>({
  id: deser.toInteger,
  name: deser.toString,
});
class UserRepo {
  constructor(private client: QueryableClient) {}
  createUser({ name }: { name: string }): Promise<User> {
    return Sql`INSERT INTO users(name) VALUES ${name} RETURNING *`.unique(userDeser).run(this.client);
  }
  findUserById(id: number): ExecutableQuery<User | null> {
    return Sql`SELECT * FROM users WHERE id = ${id}`.option(userDeser).run(this.client);
  }
  findAll(): ExecutableQuery<User[]> {
    return Sql`SELECT * FROM users`.list(userDeser).run(this.client);
  }
}
```

Then the service is responsible to call the repo

```ts
class UserService {
  // Notice that the userRepoFactory is function that returns the UserRepo once we pass a client
  constructor(private sqlExecutor: SqlExecutor, private userRepoFactory: (client: QueryableClient) => UserRepo) {}

  createUser({ name }: { name: string }): Promise<User> {
    return sqlExecutor.run((client) => this.userRepo(client).createUser(payload));
  }
  findUserById(id: number): Promise<User | null> {
    return sqlExecutor.run((client) => this.userRepo(client).findUserById(id));
  }
  findAll(): Promise<User[]> {
    return sqlExecutor.run((client) => this.userRepo(client).findAll());
  }
}
```

For the tests, the idea is same than above

```ts
const fakeClient: QueryableClient = {
  query: (): any => ({
    rows: [],
  }),
};
const fakeExecutor: SqlExecutor = {
  async run<T>(fn: ExecutableQuery<T> | ((client: QueryableClient) => Promise<T>)): Promise<T> {
    if (fn instanceof ExecutableQuery) {
      return fn.run(fakeClient);
    } else {
      return fn(fakeClient);
    }
  },
  async transact<T>(fn: ExecutableQuery<T> | ((client: QueryableClient) => Promise<T>)): Promise<T> {
    if (fn instanceof ExecutableQuery) {
      return fn.run(fakeClient);
    } else {
      return fn(fakeClient);
    }
  },
};
const fakeRepo = {
  createUser({ name }: { name: string }): ExecutableQuery<User> {
    return ExecutableQuery.of({ id: 1, name: 'georges' });
  },
  findUserById(id: number): ExecutableQuery<User | null> {
    return ExecutableQuery.of(null);
  },
  findAll(): ExecutableQuery<User[]> {
    return ExecutableQuery.of([{ id: 1, name: 'georges' }]);
  },
};
const userServiceUnderTest = new UserService(fakeExecutor, () => fakeRepo);
```

Here the interfaces of the different classes are clean of any trace of posigrade.
But it leads to a code that feels more cumbersome because we need to pass `client` explicitly everywhere,
and we deprive ourselves of all the combinators that we can use on ExecutableQuery

## Release procedure

```
git checkout master
git reset --hard HEAD
npm run release
npm publish
```
