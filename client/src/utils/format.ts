const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function formatMissionTime(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${day} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}  ${hours}:${minutes}:${seconds}Z`;
}

export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toISOString().slice(11, 19)}Z`;
}

export function formatValue(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

export function formatDelta(value: number, decimals: number): string {
  const text = Math.abs(value).toFixed(decimals);
  if (value > 0) return `+${text}`;
  if (value < 0) return `-${text}`;
  return text;
}

export function formatConfidence(value: number): string {
  return value.toFixed(2);
}
