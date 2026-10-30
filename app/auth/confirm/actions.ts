"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { confirmationFailurePath, confirmationSuccessPath } from "@/lib/auth-callback";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const supportedTypes = new Set<EmailOtpType>(["email", "recovery"]);
const field = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
};

export async function confirmAuth(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/login?message=configuration");

  const code = field(formData, "code");
  const tokenHash = field(formData, "tokenHash");
  const typeValue = field(formData, "type");
  const type = supportedTypes.has(typeValue as EmailOtpType) ? typeValue as EmailOtpType : null;
  const next = field(formData, "next") === "recovery" ? "recovery" : null;
  const supabase = await createClient();
  let confirmed = false;

  try {
    if (code && code.length <= 2048) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      confirmed = !error;
    } else if (tokenHash && tokenHash.length <= 2048 && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      confirmed = !error;
    }
  } catch {
    confirmed = false;
  }

  if (!confirmed) redirect(confirmationFailurePath);
  redirect(confirmationSuccessPath(next, type === "recovery" ? "recovery" : "email"));
}
