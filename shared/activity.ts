/** Compact relative activity time, using the source host's timestamp. */
export function activityTime(timestamp: string | null | undefined, now = Date.now()): string {
  const time = timestamp ? Date.parse(timestamp) : NaN;
  if (!Number.isFinite(time)) return '';
  const seconds = Math.max(0, (now - time) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  if (seconds < 31536000) return `${Math.floor(seconds / 604800)}w`;
  return `${Math.floor(seconds / 31536000)}y`;
}
