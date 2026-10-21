const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function validEventEmail(value: FormDataEntryValue | null): { email: string; normalized: string } | null {
  if (typeof value !== "string") return null;
  const email = value.trim();
  if (email.length > 254 || !emailPattern.test(email) || /[\x00-\x1f\x7f]/.test(email)) return null;
  return { email, normalized: email.toLowerCase() };
}

export function validEventRegistration(data: FormData) {
  const value = data.get("fullName");
  const name = typeof value === "string" ? value.trim() : "";
  const email = validEventEmail(data.get("email"));
  const consent = data.get("photographyConsent");
  if (!name || name.length > 120 || /[\x00-\x1f\x7f]/.test(name) || !email || (consent !== "yes" && consent !== "no")) return null;
  return { name, ...email, consent: consent === "yes" };
}
