export function protectedRouteRedirect(pathname: string) {
  if (pathname === "/dashboard") return "/login";
  if (pathname === "/update-password") return "/forgot-password?message=confirmation-error";
  return null;
}
