export function visibleEditHistory<T extends { editedAt: string }>(
  history: T[] | null | undefined,
  dismissedAt?: string | Date | null,
): T[] {
  if (!history?.length) return [];
  if (!dismissedAt) return history;
  const cutoff = new Date(dismissedAt).getTime();
  if (!Number.isFinite(cutoff)) return history;
  return history.filter((entry) => new Date(entry.editedAt).getTime() > cutoff);
}
