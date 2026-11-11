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
