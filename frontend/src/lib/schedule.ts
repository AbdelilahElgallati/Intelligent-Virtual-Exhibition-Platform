export function parseTimeToMinutes(value?: string): number | null {
  if (!value || !value.includes(':')) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function isOvernightSlot(startTime?: string, endTime?: string): boolean {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null || end === null) return false;
  return end < start;
}

export function formatSlotRangeLabel(startTime?: string, endTime?: string, separator = '→'): string {
  const start = startTime || '--:--';
  if (!endTime) return start;
  const overnight = isOvernightSlot(startTime, endTime);
  return `${start} ${separator} ${endTime}${overnight ? ' (+1 day)' : ''}`;
}
