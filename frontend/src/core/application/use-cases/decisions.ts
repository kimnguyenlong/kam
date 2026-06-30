import type { Decision, EffectiveGrant } from "@/core/domain/entities";
import type { DecisionService } from "@/core/domain/repositories";

export interface CheckAccessInput {
  userId: string;
  resourceType: string;
  action: string;
  itemId: string;
}

export interface DecisionUseCases {
  check(input: CheckAccessInput): Promise<Decision>;
  expand(userId: string): Promise<EffectiveGrant[]>;
  seed(): Promise<void>;
}

export function makeDecisionUseCases(service: DecisionService): DecisionUseCases {
  return {
    check: (input) => service.check(input),
    expand: (userId) => service.expand(userId),
    seed: () => service.seed(),
  };
}
