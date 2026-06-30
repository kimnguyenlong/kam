/** Centralized TanStack Query keys so hooks and invalidations stay in sync. */
export const queryKeys = {
  resourceTypes: ["resource-types"] as const,
  resourceType: (key: string) => ["resource-types", key] as const,
  items: ["items"] as const,
  item: (id: string) => ["items", id] as const,
  conditions: ["conditions"] as const,
  condition: (id: string) => ["conditions", id] as const,
  roles: ["roles"] as const,
  role: (id: string) => ["roles", id] as const,
  users: ["users"] as const,
  user: (id: string) => ["users", id] as const,
};
