/**
 * KamHttpClient — thin fetch wrapper used by the HTTP repositories. It targets
 * the Next route-handler proxy (`/api/kam/*`), which forwards to the Go service
 * server-side, so the backend origin stays off the client and CORS is moot.
 */
export class KamApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "KamApiError";
  }
}

export class KamHttpClient {
  constructor(private readonly baseUrl: string = "/api/kam") {}

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async delete(path: string): Promise<void> {
    await this.request<void>("DELETE", path);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      try {
        const data = await res.json();
        if (data && typeof data.error === "string") message = data.error;
      } catch {
        /* non-JSON error body */
      }
      throw new KamApiError(res.status, message);
    }

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}
