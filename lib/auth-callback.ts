export function confirmationSuccessPath(next: string | null, type?: "email" | "recovery") {
  return type === "recovery" || next === "recovery" ? "/update-password" : "/auth/confirmed";
}

export const confirmationFailurePath = "/login?message=confirmation-error";
