const messages = {
  "check-email": "If registration succeeds, check your email to confirm your address before signing in.",
  "invalid-login": "Unable to sign in with those credentials.",
  "invalid-registration": "Use a valid email address and a password that meets the stated requirements.",
  "password-mismatch": "The password confirmation does not match.",
  "registration-unavailable": "We could not complete registration. Please try again later.",
  "registration-disabled": "Registration is not available right now. Please contact the site administrator.",
  "email-rate-limited": "Too many confirmation emails have been requested. Please wait a while and try again.",
  "registration-rate-limited": "Too many registration requests have been made. Please wait a while and try again.",
  "email-delivery-unavailable": "We could not send a confirmation email. Please try again later.",
  "turnstile-failed": "Please complete the security verification and try again.",
  "turnstile-unavailable": "Security verification is not configured yet. Please contact the site administrator.",
  "reset-sent": "If an account exists for that email address, a password reset link has been sent.",
  "invalid-email": "Enter a valid email address.",
  "reset-unavailable": "We could not start a password reset. Please try again later.",
  "confirmation-error": "That link is invalid or has expired. Request a new one and try again.",
  "password-updated": "Your password has been updated. You can now sign in.",
  "update-unavailable": "We could not update your password. Request a new reset link and try again.",
  "configuration": "Authentication is not configured yet. Please contact the site administrator.",
} as const;

export function AuthMessage({ code }: { code?: string }) {
  const message = code && code in messages ? messages[code as keyof typeof messages] : null;
  if (!message) return null;
  const isSuccess = code ? ["check-email", "reset-sent", "password-updated"].includes(code) : false;
  return <p className={isSuccess ? "auth-message auth-message-success" : "auth-message"} role="status">{message}</p>;
}
