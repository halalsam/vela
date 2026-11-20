const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function fromNow(days: number, hours = 0): string {
  return new Date(Date.now() + days * DAY + hours * HOUR).toISOString();
}

export function daysAgoDate(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
}
