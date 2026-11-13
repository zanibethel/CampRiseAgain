/**
 * Only expose known, user-actionable authentication errors on Camp's
 * password reset form. Never render raw provider error text or credentials.
 */
export function campPasswordUpdateErrorMessage(error: { code?: string } | null): string {
  if (error?.code === "same_password") {
    return "This is already your current password. Choose a different password to change it.";
  }
  return "Could not save your password. Try a different strong password, or request a new recovery link.";
}
