import { NextRequest } from "next/server";
import { kamApiBaseUrl } from "@/infrastructure/config/server-env";

/**
 * Server-side proxy: browser → /api/kam/<path> → ${KAM_API_BASE_URL}/v1/<path>.
 * Keeps the Go backend origin off the client and avoids CORS. The Go service
 * does no auth, so we forward method, body, and a JSON content-type only.
 */
export const dynamic = "force-dynamic";

async function proxy(req: NextRequest, segments: string[]) {
  const search = req.nextUrl.search;
  const target = `${kamApiBaseUrl()}/v1/${segments.map(encodeURIComponent).join("/")}${search}`;

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.text() : undefined;

  try {
    const res = await fetch(target, {
      method: req.method,
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: body && body.length > 0 ? body : undefined,
      cache: "no-store",
    });

    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
    });
  } catch {
    return Response.json(
      { error: `KAM service unreachable at ${kamApiBaseUrl()}` },
      { status: 502 },
    );
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path);
}
export async function PUT(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path);
}
