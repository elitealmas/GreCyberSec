"use server";

import { validateContactInput } from "@/lib/contact-validation";

export type ContactFormState = { success: boolean; message: string; errors?: { name?: string; email?: string; message?: string } };
export const initialContactState: ContactFormState = { success: false, message: "" };

function value(formData: FormData, key: string) { const item = formData.get(key); return typeof item === "string" ? item.trim() : ""; }

export async function submitContact(_previousState: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const honeypot = value(formData, "website");
  const name = value(formData, "name");
  const email = value(formData, "email");
  const message = value(formData, "message");
  // Treat all form data as hostile. This initial action deliberately stores or forwards nothing.
  if (honeypot) return { success: true, message: "Thanks — your message has been received." };
  const errors = validateContactInput({ name, email, message });
  if (Object.keys(errors).length) return { success: false, message: "Please correct the highlighted fields.", errors };
  return { success: true, message: "Your message is valid. This demonstration form does not send or retain it." };
}
