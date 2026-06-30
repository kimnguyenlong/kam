import type { CrudRepository } from "@/core/domain/repositories";
import type { KamHttpClient } from "../http/kam-http-client";

/** Optional wire<->domain translation for entities whose JSON differs from the domain shape. */
export interface EntityMapper<TDomain, TWire> {
  fromWire(wire: TWire): TDomain;
  toWire(entity: TDomain): TWire;
}

const identityMapper: EntityMapper<unknown, unknown> = {
  fromWire: (w) => w,
  toWire: (e) => e,
};

/**
 * HTTP-backed CrudRepository hitting the Go service's generic `crud[T]` routes
 * (`GET /`, `PUT /`, `GET /{id}`, `DELETE /{id}`) under a base path.
 */
export class HttpCrudRepository<TDomain, TWire = TDomain> implements CrudRepository<TDomain> {
  private readonly mapper: EntityMapper<TDomain, TWire>;

  constructor(
    private readonly http: KamHttpClient,
    private readonly basePath: string,
    mapper?: EntityMapper<TDomain, TWire>,
  ) {
    this.mapper = mapper ?? (identityMapper as EntityMapper<TDomain, TWire>);
  }

  async list(): Promise<TDomain[]> {
    const wire = (await this.http.get<TWire[]>(`${this.basePath}`)) ?? [];
    return wire.map((w) => this.mapper.fromWire(w));
  }

  async get(id: string): Promise<TDomain> {
    const wire = await this.http.get<TWire>(`${this.basePath}/${encodeURIComponent(id)}`);
    return this.mapper.fromWire(wire);
  }

  async upsert(entity: TDomain): Promise<TDomain> {
    const wire = await this.http.put<TWire>(`${this.basePath}`, this.mapper.toWire(entity));
    return this.mapper.fromWire(wire);
  }

  async remove(id: string): Promise<void> {
    await this.http.delete(`${this.basePath}/${encodeURIComponent(id)}`);
  }
}
