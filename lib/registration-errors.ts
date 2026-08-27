type RegistrationError = {
  message?: string;
  code?: string;
  status?: number;
};

export function registrationFailureMessage(error: RegistrationError) {
  const message = error.message?.toLowerCase() ?? "";
  const code = error.code?.toLowerCase() ?? "";
  const isEmailRateLimit = code === "over_email_send_rate_limit"
    || (error.status === 429 && /(email|mail|confirmation)/.test(message));

  if (isEmailRateLimit) return "email-rate-limited";
  if (error.status === 429 || code.includes("rate_limit") || message.includes("rate limit")) return "registration-rate-limited";
  if (message.includes("signups are disabled") || message.includes("provider is disabled")) return "registration-disabled";
  if (message.includes("sending confirmation") || message.includes("sending email")) return "email-delivery-unavailable";
  return "registration-unavailable";
}
