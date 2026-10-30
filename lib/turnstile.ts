type TurnstileVerification = {
  success?: boolean;
  action?: string;
  hostname?: string;
};

const siteverifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileAction = "register" | "login" | "password-reset" | "event-register" | "contact";

export function turnstileExpectedHostname() {
  const configured = process.env.TURNSTILE_EXPECTED_HOSTNAME?.trim();
  if (configured) return configured;
  try {
    const site = new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
    return site.hostname;
  } catch {
    return null;
  }
}

export async function verifyTurnstileToken(token: string, expectedAction: TurnstileAction, expectedHostname?: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token || token.length > 2048) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    const response = await fetch(siteverifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;

    const result = await response.json() as TurnstileVerification;
    return result.success === true && result.action === expectedAction && (!expectedHostname || result.hostname === expectedHostname);
  } catch {
    return false;
  }
}
