"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { container } from "@/composition/container";
import type { CheckAccessInput } from "@/core/application/use-cases/decisions";

export function useCheckAccess() {
  return useMutation({
    mutationFn: (input: CheckAccessInput) => container.decisions.check(input),
  });
}

export function useExpandUser() {
  return useMutation({
    mutationFn: (userId: string) => container.decisions.expand(userId),
  });
}

export function useSeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => container.decisions.seed(),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Prototype data seeded");
    },
    onError: (e: Error) => toast.error(`Seed failed: ${e.message}`),
  });
}
