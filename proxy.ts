import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

function createContentSecurityPolicy(nonce?: string) {
  const isProduction = process.env.NODE_ENV === "production";
  const scriptSource = isProduction
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com`
    : "'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com";
  const styleSource = isProduction ? `'self' 'nonce-${nonce}'` : "'self' 'unsafe-inline'";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    `script-src ${scriptSource}`,
    `style-src ${styleSource}`,
    "frame-src https://challenges.cloudflare.com",
    `connect-src 'self' https://challenges.cloudflare.com${isProduction ? "" : " ws: wss:"}`,
    "font-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const isProduction = process.env.NODE_ENV === "production";
  const nonce = isProduction ? Buffer.from(crypto.randomUUID()).toString("base64") : undefined;
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  if (nonce) requestHeaders.set("x-nonce", nonce);

  const response = await updateSession(request, requestHeaders);
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
