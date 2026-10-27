// Daily sessions in a fixed time zone (the showroom restream), shown in the visitor's own time zone.
// Pure Intl date maths, so it stays correct across daylight-saving changes without a date library.

/** Minutes the zone is ahead of UTC at this instant, e.g. 120 for Europe/Sofia in winter. */
export function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** The instant when the zone's wall clock shows hh:mm on the zone's date that is `dayOffset` days from `now`. */
function wallClockToInstant(now: Date, dayOffset: number, hhmm: string, timeZone: string): number {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const [y, mo, d] = today.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, mo - 1, d + dayOffset, h, m);
  // Correct with the offset at the guessed instant, then once more in case that crossed a DST change.
  const first = guess - zoneOffsetMinutes(new Date(guess), timeZone) * 60000;
  return guess - zoneOffsetMinutes(new Date(first), timeZone) * 60000;
}

export interface Session {
  start: Date;
  end: Date;
  live: boolean;
}

/** The session running now, or the next one. */
export function currentOrNextSession(dailyAt: string, timeZone: string, minutes: number, now = new Date()): Session {
  for (const day of [-1, 0, 1, 2]) {
    const start = wallClockToInstant(now, day, dailyAt, timeZone);
    const end = start + minutes * 60000;
    if (end > now.getTime()) return { start: new Date(start), end: new Date(end), live: start <= now.getTime() };
  }
  throw new Error('No session found in the next two days');
}

/** "today at 20:00", "tomorrow at 20:00" or "Thursday at 20:00", in the visitor's locale and time zone. */
export function describeStart(start: Date, now = new Date()): string {
  const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(start);
  const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA').format(d);
  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (dayKey(start) === dayKey(now)) return `today at ${time}`;
  if (dayKey(start) === dayKey(tomorrow)) return `tomorrow at ${time}`;
  return `${new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(start)} at ${time}`;
}

export function describeWait(start: Date, now = new Date()): string {
  const mins = Math.max(0, Math.round((start.getTime() - now.getTime()) / 60000));
  if (mins < 60) return `in ${mins} minute${mins === 1 ? '' : 's'}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `in ${h} h${m ? ` ${m} min` : ''}`;
}
