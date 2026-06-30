"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { container } from "@/composition/container";
import { queryKeys } from "@/lib/query-keys";
import type { CrudUseCases } from "@/core/application/use-cases/crud";
import type {
  Condition,
  Item,
  ResourceType,
  Role,
  User,
} from "@/core/domain/entities";

/** Builds {useList, useSave, useRemove} hooks for an entity from its use-cases. */
function crudHooks<T>(useCases: CrudUseCases<T>, key: readonly string[], label: string) {
  function useList() {
    return useQuery({ queryKey: key, queryFn: () => useCases.list() });
  }

  function useSave() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (entity: T) => useCases.save(entity),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: key });
        toast.success(`${label} saved`);
      },
      onError: (e: Error) => toast.error(`Save failed: ${e.message}`),
    });
  }

  function useRemove() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => useCases.remove(id),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: key });
        toast.success(`${label} deleted`);
      },
      onError: (e: Error) => toast.error(`Delete failed: ${e.message}`),
    });
  }

  return { useList, useSave, useRemove };
}

export const resourceTypeHooks = crudHooks<ResourceType>(
  container.resourceTypes,
  queryKeys.resourceTypes,
  "Resource type",
);
export const itemHooks = crudHooks<Item>(container.items, queryKeys.items, "Item");
export const conditionHooks = crudHooks<Condition>(
  container.conditions,
  queryKeys.conditions,
  "Condition",
);
export const roleHooks = crudHooks<Role>(container.roles, queryKeys.roles, "Role");
export const userHooks = crudHooks<User>(container.users, queryKeys.users, "User");
