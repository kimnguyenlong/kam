import type { CrudRepository } from "@/core/domain/repositories";

/**
 * CRUD use-cases for a config entity. Thin application layer over a repository
 * port — keeps presentation hooks decoupled from infrastructure. Mutations on
 * the Go service trigger a Keto resync server-side, so callers just refetch.
 */
export interface CrudUseCases<T> {
  list(): Promise<T[]>;
  get(id: string): Promise<T>;
  save(entity: T): Promise<T>;
  remove(id: string): Promise<void>;
}

export function makeCrudUseCases<T>(repo: CrudRepository<T>): CrudUseCases<T> {
  return {
    list: () => repo.list(),
    get: (id) => repo.get(id),
    save: (entity) => repo.upsert(entity),
    remove: (id) => repo.remove(id),
  };
}
