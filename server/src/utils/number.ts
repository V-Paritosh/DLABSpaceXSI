export function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function formatReading(value: number, digits: number): string {
  return value.toFixed(digits);
}
