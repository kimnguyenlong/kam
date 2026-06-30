/**
 * GrantKey — a role grant key of the form `<resourceKey>:<action>`.
 * Resource keys contain dots (e.g. `billing.invoice:approve`), so the split is
 * on the LAST colon — mirrors `keto.SplitGrantKey` (Go `strings.LastIndex`).
 */
export interface GrantKey {
  resourceKey: string;
  action: string;
}

export const GrantKey = {
  make(resourceKey: string, action: string): string {
    return `${resourceKey}:${action}`;
  },
  split(key: string): GrantKey | null {
    const i = key.lastIndexOf(":");
    if (i < 0) return null;
    return { resourceKey: key.slice(0, i), action: key.slice(i + 1) };
  },
} as const;
