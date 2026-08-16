export type ContactErrors = { name?: string; email?: string; message?: string };
export type ContactInput = { name: string; email: string; message: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContactInput(input: ContactInput): ContactErrors {
  const errors: ContactErrors = {};
  if (input.name.length < 2 || input.name.length > 80) errors.name = "Enter a name between 2 and 80 characters.";
  if (input.email.length > 254 || !emailPattern.test(input.email)) errors.email = "Enter a valid email address.";
  if (input.message.length < 10 || input.message.length > 1500) errors.message = "Enter a message between 10 and 1,500 characters.";
  return errors;
}
