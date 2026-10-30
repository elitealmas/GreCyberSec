const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const controlCharacters = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
const requestTypes = new Set(["access", "correction", "deletion", "photography", "other"]);

const value = (data: FormData, field: string) => {
  const entry = data.get(field);
  return typeof entry === "string" ? entry.trim() : "";
};

export type PrivateContactRequest = {
  name: string;
  email: string;
  normalized: string;
  requestType: "access" | "correction" | "deletion" | "photography" | "other";
  message: string;
};

export function validPrivateContactRequest(data: FormData): PrivateContactRequest | null {
  const name = value(data, "name");
  const email = value(data, "email");
  const requestType = value(data, "requestType");
  const message = value(data, "message");
  if (name.length < 2 || name.length > 120 || controlCharacters.test(name)
    || email.length > 254 || !emailPattern.test(email) || controlCharacters.test(email)
    || !requestTypes.has(requestType)
    || message.length < 10 || message.length > 3000 || controlCharacters.test(message)) return null;
  return { name, email, normalized: email.toLowerCase(), requestType: requestType as PrivateContactRequest["requestType"], message };
}
