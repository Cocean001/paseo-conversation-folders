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

export type TimeBucket = 'today' | 'yesterday' | 'week' | 'month' | 'older';
/** Calendar section for a timestamp in the viewer's local days: today, yesterday, then the 7 and 30 days before. */
export function timeBucket(timestamp: string | null | undefined, now = Date.now()): TimeBucket {
  const time = timestamp ? Date.parse(timestamp) : NaN;
  if (!Number.isFinite(time)) return 'older';
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const days = (today.getTime() - time) / 86400000;
  return days <= 0 ? 'today' : days <= 1 ? 'yesterday' : days <= 7 ? 'week' : days <= 30 ? 'month' : 'older';
}
