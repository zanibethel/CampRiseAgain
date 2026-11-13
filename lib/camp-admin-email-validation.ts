/** Validate an administrator email before an Auth request. This is not authorization:
 * server-side Camp admin membership is checked separately after sign-in. */
export function normalizedCampAdminEmail(value: string): string | null {
  const address = value.trim().toLowerCase();
  return address.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address)
    ? address : null;
}
