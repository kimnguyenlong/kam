import "server-only";

/** Server-only config for the proxy route handler. Never imported by client code. */
export function kamApiBaseUrl(): string {
  return process.env.KAM_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8080";
}
