import type {
  Condition,
  Item,
  ResourceType,
  Role,
  User,
} from "@/core/domain/entities";
import { makeCrudUseCases, type CrudUseCases } from "@/core/application/use-cases/crud";
import {
  makeDecisionUseCases,
  type DecisionUseCases,
} from "@/core/application/use-cases/decisions";
import { KamHttpClient } from "@/infrastructure/http/kam-http-client";
import { HttpCrudRepository } from "@/infrastructure/repositories/http-crud-repository";
import { HttpDecisionService } from "@/infrastructure/repositories/http-decision-service";
import { roleFromWire, roleToWire, type WireRole } from "@/infrastructure/mappers/role-mapper";

/**
 * Composition root — the only place infrastructure is wired to use-cases.
 * Presentation imports `container` and depends on application interfaces only,
 * preserving the clean-architecture dependency rule (inward-pointing).
 */
export interface Container {
  resourceTypes: CrudUseCases<ResourceType>;
  items: CrudUseCases<Item>;
  conditions: CrudUseCases<Condition>;
  roles: CrudUseCases<Role>;
  users: CrudUseCases<User>;
  decisions: DecisionUseCases;
}

function build(): Container {
  const http = new KamHttpClient();

  return {
    resourceTypes: makeCrudUseCases(
      new HttpCrudRepository<ResourceType>(http, "/resource-types"),
    ),
    items: makeCrudUseCases(new HttpCrudRepository<Item>(http, "/items")),
    conditions: makeCrudUseCases(new HttpCrudRepository<Condition>(http, "/conditions")),
    roles: makeCrudUseCases(
      new HttpCrudRepository<Role, WireRole>(http, "/roles", {
        fromWire: roleFromWire,
        toWire: roleToWire,
      }),
    ),
    users: makeCrudUseCases(new HttpCrudRepository<User>(http, "/users")),
    decisions: makeDecisionUseCases(new HttpDecisionService(http)),
  };
}

export const container: Container = build();
