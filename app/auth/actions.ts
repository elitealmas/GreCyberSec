"use server";

import { redirect } from "next/navigation";
import { validateCredentials, validateEmail, validateNewPassword } from "@/lib/auth-validation";
import { createClient } from "@/lib/supabase/server";

function go(path: string, message: string): never {
  redirect(`${path}?message=${message}`);
}

function registrationFailureMessage(error: { message: string; code?: string }) {
  const normalised = error.message.toLowerCase();
  if (error.code === "over_email_send_rate_limit" || normalised.includes("rate limit")) return "email-rate-limited";
  if (normalised.includes("signups are disabled") || normalised.includes("provider is disabled")) return "registration-disabled";
  if (normalised.includes("sending confirmation") || normalised.includes("sending email")) return "email-delivery-unavailable";
  return "registration-unavailable";
}

export async function register(formData: FormData) {
  const credentials = validateCredentials(formData);
  const password = validateNewPassword(formData);
  if (!credentials || typeof password !== "string") {
    go("/register", password === "mismatch" ? "password-mismatch" : "invalid-registration");
  }

  let message = "check-email";
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({ email: credentials.email, password });
    if (error) {
      console.error("Supabase registration failed", { status: error.status, code: error.code });
      message = registrationFailureMessage(error);
    }
  } catch (error) {
    console.error("Supabase registration request failed", { name: error instanceof Error ? error.name : "UnknownError" });
    message = "registration-unavailable";
  }

  go("/register", message);
}

export async function login(formData: FormData) {
  const credentials = validateCredentials(formData);
  if (!credentials) go("/login", "invalid-login");

  let loginFailed = false;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(credentials);
    loginFailed = Boolean(error);
  } catch {
    loginFailed = true;
  }

  if (loginFailed) go("/login", "invalid-login");
  redirect("/dashboard");
}

export async function requestPasswordReset(formData: FormData) {
  const email = validateEmail(formData);
  if (!email) go("/forgot-password", "invalid-email");

  try {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email);
  } catch {
    // Keep this response indistinguishable from a successful request.
  }

  go("/forgot-password", "reset-sent");
}

export async function updatePassword(formData: FormData) {
  const password = validateNewPassword(formData);
  if (typeof password !== "string") {
    go("/update-password", password === "mismatch" ? "password-mismatch" : "invalid-registration");
  }

  let failure: { path: string; message: string } | null = null;
  try {
    const supabase = await createClient();
    const { data, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || !data?.claims) {
      failure = { path: "/forgot-password", message: "confirmation-error" };
    } else {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) failure = { path: "/update-password", message: "update-unavailable" };
    }
  } catch {
    failure = { path: "/update-password", message: "update-unavailable" };
  }

  if (failure) go(failure.path, failure.message);
  go("/login", "password-updated");
}

export async function logout() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } finally {
    redirect("/login");
  }
}
