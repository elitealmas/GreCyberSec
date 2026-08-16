const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Credentials = { email: string; password: string };

function text(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

export function validateEmail(formData: FormData) {
  const email = text(formData, "email").toLowerCase();
  return email.length <= 254 && emailPattern.test(email) ? email : null;
}

export function validatePassword(password: string) {
  return password.length >= 12
    && password.length <= 128
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password);
}

export function validateCredentials(formData: FormData): Credentials | null {
  const email = validateEmail(formData);
  const password = text(formData, "password");
  return email && password.length <= 128 ? { email, password } : null;
}

export function validateNewPassword(formData: FormData) {
  const password = text(formData, "password");
  const confirmation = text(formData, "confirmPassword");
  if (password !== confirmation) return "mismatch" as const;
  return validatePassword(password) ? password : null;
}
