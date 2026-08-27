const messages = {
  "progress-unavailable": "We could not update your lesson progress. Please try again.",
  "quiz-unavailable": "We could not submit that quiz attempt. Please try again.",
} as const;

export function CourseMessage({ code }: { code?: string }) {
  const message = code && code in messages ? messages[code as keyof typeof messages] : null;
  return message ? <p className="auth-message" role="status">{message}</p> : null;
}
