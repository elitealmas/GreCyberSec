import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { confirmationFailurePath, confirmationSuccessPath } from "@/lib/auth-callback";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const supportedTypes = new Set<EmailOtpType>(["email", "recovery"]);

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.redirect(getSiteUrl("/login?message=configuration"));
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = request.nextUrl.searchParams.get("next");
  const failureUrl = getSiteUrl(confirmationFailurePath);
  const supabase = await createClient();

  if (code) {
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(getSiteUrl(confirmationSuccessPath(next)));
    } catch {
      // Invalid, expired, or already-used codes follow the same safe failure path.
    }

    return NextResponse.redirect(failureUrl);
  }

  if (!tokenHash || !type || !supportedTypes.has(type)) {
    return NextResponse.redirect(failureUrl);
  }

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return NextResponse.redirect(failureUrl);

  return NextResponse.redirect(getSiteUrl(confirmationSuccessPath(next, type === "recovery" ? "recovery" : "email")));
}
