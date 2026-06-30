import type { Decision, EffectiveGrant } from "@/core/domain/entities";
import type { DecisionService } from "@/core/domain/repositories";
import type { KamHttpClient } from "../http/kam-http-client";
import { effectFromWire, type WireEffect } from "../mappers/effect-mapper";

/** Wire shape of the `/expand` response: a map of grant key -> provenance. */
type WireExpand = Record<
  string,
  { effect: WireEffect; source: string; inherited: boolean; viaRole: string }
>;

export class HttpDecisionService implements DecisionService {
  constructor(private readonly http: KamHttpClient) {}

  check(input: {
    userId: string;
    resourceType: string;
    action: string;
    itemId: string;
  }): Promise<Decision> {
    return this.http.post<Decision>("/check", input);
  }

  async expand(userId: string): Promise<EffectiveGrant[]> {
    const wire = await this.http.post<WireExpand>("/expand", { userId });
    return Object.entries(wire ?? {})
      .map(([key, g]) => ({
        key,
        effect: effectFromWire(g.effect),
        source: g.source,
        inherited: g.inherited,
        viaRole: g.viaRole,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  async seed(): Promise<void> {
    await this.http.post<unknown>("/seed");
  }
}
