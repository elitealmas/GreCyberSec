type TurnstileVerification = {
  success?: boolean;
  action?: string;
};

const siteverifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(token: string, expectedAction: "register" | "login") {
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
    return result.success === true && result.action === expectedAction;
  } catch {
    return false;
  }
}
