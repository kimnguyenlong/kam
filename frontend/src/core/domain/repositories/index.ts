import type {
  Condition,
  Decision,
  EffectiveGrant,
  Item,
  ResourceType,
  Role,
  User,
} from "../entities";

/**
 * Generic CRUD port for a config entity. Infrastructure implements it over HTTP.
 * The Go service exposes list/get/upsert(PUT)/delete uniformly via `crud[T]`.
 */
export interface CrudRepository<T> {
  list(): Promise<T[]>;
  get(id: string): Promise<T>;
  upsert(entity: T): Promise<T>;
  remove(id: string): Promise<void>;
}

export type ResourceTypeRepository = CrudRepository<ResourceType>;
export type ItemRepository = CrudRepository<Item>;
export type ConditionRepository = CrudRepository<Condition>;
export type RoleRepository = CrudRepository<Role>;
export type UserRepository = CrudRepository<User>;

/** Port for the decision engine endpoints (`/check`, `/expand`) and seeding. */
export interface DecisionService {
  check(input: {
    userId: string;
    resourceType: string;
    action: string;
    itemId: string;
  }): Promise<Decision>;
  expand(userId: string): Promise<EffectiveGrant[]>;
  seed(): Promise<void>;
}
