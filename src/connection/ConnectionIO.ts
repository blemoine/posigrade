import { ClientBase } from 'pg';

export interface ConnectionIO<T> {
  run(client: ClientBase): Promise<T>;
}

export function mkConnectionIO<T>(run: (client: ClientBase) => Promise<T>): ConnectionIO<T> {
  return { run };
}
