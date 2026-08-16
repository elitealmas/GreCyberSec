import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const supportedTypes = new Set<EmailOtpType>(["email", "recovery"]);

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.redirect(getSiteUrl("/login?message=configuration"));
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const failureUrl = getSiteUrl("/login?message=confirmation-error");

  if (!tokenHash || !type || !supportedTypes.has(type)) {
    return NextResponse.redirect(failureUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return NextResponse.redirect(failureUrl);

  return NextResponse.redirect(type === "recovery" ? getSiteUrl("/update-password") : "http://localhost:3000/auth/confirmed");
}
