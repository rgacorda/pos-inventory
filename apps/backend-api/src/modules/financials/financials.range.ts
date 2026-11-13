import { BadRequestException } from '@nestjs/common';

/**
 * Financial periods are calendar days in the shop's timezone. Order and
 * delivery timestamps are stored without a time zone, and the inventory app
 * sends UTC instants from the browser, so month bounds and "end of the day
 * the user picked" have to be resolved here rather than with the server clock.
 */
export function businessTimeZone(): string {
  return process.env.APP_TIMEZONE || 'Asia/Manila';
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  // A few engines report midnight as hour 24 on the previous calendar day.
  let hour = pick('hour');
  let day = pick('day');
  let month = pick('month');
  let year = pick('year');
  if (hour === 24) {
    hour = 0;
    const rolled = new Date(Date.UTC(year, month - 1, day + 1));
    year = rolled.getUTCFullYear();
    month = rolled.getUTCMonth() + 1;
    day = rolled.getUTCDate();
  }

  return {
    year,
    month,
    day,
    hour,
    minute: pick('minute'),
    second: pick('second'),
  };
}

/** UTC instant for a wall-clock time in `timeZone`. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string,
): Date {
  // Interpret the wall clock as UTC, then shift by the zone offset observed
  // at that guess. A second pass only repairs a DST gap; repeating the first
  // formula would apply the offset twice.
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const guessedWall = zonedParts(new Date(asUtc), timeZone);
  const guessedWallAsUtc = Date.UTC(
    guessedWall.year,
    guessedWall.month - 1,
    guessedWall.day,
    guessedWall.hour,
    guessedWall.minute,
    guessedWall.second,
    ms,
  );
  let utc = asUtc - (guessedWallAsUtc - asUtc);

  const actual = zonedParts(new Date(utc), timeZone);
  const actualAsUtc = Date.UTC(
    actual.year,
    actual.month - 1,
    actual.day,
    actual.hour,
    actual.minute,
    actual.second,
    ms,
  );
  if (actualAsUtc !== asUtc) {
    utc -= actualAsUtc - asUtc;
  }
  return new Date(utc);
}

export interface BusinessMonthRange {
  startDate: string;
  endDate: string;
  label: string;
}

export function currentBusinessMonthRange(
  now = new Date(),
  timeZone = businessTimeZone(),
): BusinessMonthRange {
  const { year, month } = zonedParts(now, timeZone);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const start = zonedTimeToUtc(year, month, 1, 0, 0, 0, 0, timeZone);
  const end = zonedTimeToUtc(year, month, lastDay, 23, 59, 59, 999, timeZone);
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'long',
    year: 'numeric',
  }).format(start);

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    label,
  };
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * A timestamp that falls on 00:00:00.000 in the business timezone is the
 * start of a calendar day. Treat it as the end of that day so a date picker
 * that emits midnight still includes the selected day.
 */
function inclusiveEnd(date: Date, timeZone: string): Date {
  const parts = zonedParts(date, timeZone);
  const isMidnight =
    parts.hour === 0 &&
    parts.minute === 0 &&
    parts.second === 0 &&
    date.getUTCMilliseconds() === 0;
  if (!isMidnight) return date;
  return zonedTimeToUtc(
    parts.year,
    parts.month,
    parts.day,
    23,
    59,
    59,
    999,
    timeZone,
  );
}

function parseBoundary(
  value: string | undefined,
  label: string,
  bound: 'start' | 'end',
  timeZone: string,
): Date {
  if (!value || !value.trim()) {
    throw new BadRequestException(`${label} is required`);
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    if (!isValidCalendarDate(year, month, day)) {
      throw new BadRequestException(`${label} is not a valid date`);
    }
    return bound === 'start'
      ? zonedTimeToUtc(year, month, day, 0, 0, 0, 0, timeZone)
      : zonedTimeToUtc(year, month, day, 23, 59, 59, 999, timeZone);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${label} is not a valid date`);
  }
  return bound === 'end' ? inclusiveEnd(date, timeZone) : date;
}

export function parseRange(
  startDate: string | undefined,
  endDate: string | undefined,
  timeZone = businessTimeZone(),
): { startDate: string; endDate: string } {
  const start = parseBoundary(startDate, 'startDate', 'start', timeZone);
  const end = parseBoundary(endDate, 'endDate', 'end', timeZone);
  if (start.getTime() > end.getTime()) {
    throw new BadRequestException('startDate must be on or before endDate');
  }
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

export type TrendBucket = 'day' | 'month';

export interface TrendPoint {
  date: string;
  label: string;
  revenue: number;
  purchases: number;
  cogs: number;
  profit: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Ranges longer than about two months are shown by month so the trend stays readable. */
export function chooseTrendBucket(
  start: Date,
  end: Date,
  timeZone = businessTimeZone(),
): TrendBucket {
  const startParts = zonedParts(start, timeZone);
  const endParts = zonedParts(end, timeZone);
  const startDay = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const endDay = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
  const days = Math.round((endDay - startDay) / 86_400_000);
  return days > 62 ? 'month' : 'day';
}

function slotLabel(date: string, bucket: TrendBucket, timeZone: string): string {
  if (bucket === 'month' && /^\d{4}-\d{2}$/.test(date)) {
    const [year, month] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      month: 'short',
      year: 'numeric',
    }).format(zonedTimeToUtc(year, month, 1, 12, 0, 0, 0, timeZone));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      month: 'short',
      day: 'numeric',
    }).format(zonedTimeToUtc(year, month, day, 12, 0, 0, 0, timeZone));
  }
  return date;
}

export function listTrendSlots(
  start: Date,
  end: Date,
  bucket: TrendBucket,
  timeZone = businessTimeZone(),
): { date: string; label: string }[] {
  const startParts = zonedParts(start, timeZone);
  const endParts = zonedParts(end, timeZone);
  const slots: { date: string; label: string }[] = [];

  if (bucket === 'month') {
    let year = startParts.year;
    let month = startParts.month;
    while (
      year < endParts.year ||
      (year === endParts.year && month <= endParts.month)
    ) {
      const date = `${year}-${pad2(month)}`;
      slots.push({ date, label: slotLabel(date, bucket, timeZone) });
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      if (slots.length > 120) break;
    }
    return slots;
  }

  let year = startParts.year;
  let month = startParts.month;
  let day = startParts.day;
  const endKey = `${endParts.year}-${pad2(endParts.month)}-${pad2(endParts.day)}`;
  while (slots.length <= 400) {
    const date = `${year}-${pad2(month)}-${pad2(day)}`;
    slots.push({ date, label: slotLabel(date, bucket, timeZone) });
    if (date === endKey) break;
    const next = zonedParts(
      new Date(
        zonedTimeToUtc(year, month, day, 12, 0, 0, 0, timeZone).getTime() +
          24 * 60 * 60 * 1000,
      ),
      timeZone,
    );
    if (next.year === year && next.month === month && next.day === day) break;
    year = next.year;
    month = next.month;
    day = next.day;
  }
  return slots;
}

function rollupDays(
  days: Record<string, number>,
  bucket: TrendBucket,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const [day, amount] of Object.entries(days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const key = bucket === 'month' ? day.slice(0, 7) : day;
    totals[key] = (totals[key] ?? 0) + (Number.isFinite(amount) ? amount : 0);
  }
  return totals;
}

/**
 * Builds one point per day or month in the range, including quiet periods,
 * so a line can show whether purchases and revenue are growing.
 */
export function assembleTrend(
  start: Date,
  end: Date,
  revenueByDay: Record<string, number>,
  purchasesByDay: Record<string, number>,
  cogsByDay: Record<string, number> = {},
  timeZone = businessTimeZone(),
): { bucket: TrendBucket; points: TrendPoint[] } {
  const bucket = chooseTrendBucket(start, end, timeZone);
  const slots = listTrendSlots(start, end, bucket, timeZone);
  const revenue = rollupDays(revenueByDay, bucket);
  const purchases = rollupDays(purchasesByDay, bucket);
  const cogs = rollupDays(cogsByDay, bucket);
  const known = new Set(slots.map((slot) => slot.date));

  for (const key of [
    ...Object.keys(revenue),
    ...Object.keys(purchases),
    ...Object.keys(cogs),
  ]) {
    if (known.has(key)) continue;
    known.add(key);
    slots.push({ date: key, label: slotLabel(key, bucket, timeZone) });
  }
  slots.sort((a, b) => a.date.localeCompare(b.date));

  const round = (amount: number) => Math.round(amount * 100) / 100;
  const points = slots.map((slot) => {
    const revenueAmount = round(revenue[slot.date] ?? 0);
    const purchaseAmount = round(purchases[slot.date] ?? 0);
    const cogsAmount = round(cogs[slot.date] ?? 0);
    return {
      date: slot.date,
      label: slot.label,
      revenue: revenueAmount,
      purchases: purchaseAmount,
      cogs: cogsAmount,
      profit: round(revenueAmount - cogsAmount),
    };
  });

  return { bucket, points };
}
