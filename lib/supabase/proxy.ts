import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";

export async function updateSession(request: NextRequest, requestHeaders = request.headers) {
  if (!isSupabaseConfigured()) return { response: NextResponse.next({ request: { headers: requestHeaders } }), userId: null };
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, responseHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(responseHeaders).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // getClaims validates the access token and refreshes it when appropriate.
  const { data, error } = await supabase.auth.getClaims();
  const userId = !error && typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  return { response, userId };
}
