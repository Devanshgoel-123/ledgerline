export function userInitials(
  user?: { displayName?: string | null } | null,
): string {
  const name = user?.displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? "";
    const last = parts[1]?.[0] ?? "";
    const initials = `${first}${last}`.toUpperCase();
    if (initials) return initials;
  }
  return "LL";
}
