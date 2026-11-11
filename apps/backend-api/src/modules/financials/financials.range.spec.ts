import { BadRequestException } from '@nestjs/common';
import {
  currentBusinessMonthRange,
  parseRange,
  zonedTimeToUtc,
} from './financials.range';

const MANILA = 'Asia/Manila';

describe('financials date range', () => {
  it('places a Manila wall-clock time on the matching UTC instant', () => {
    const start = zonedTimeToUtc(2026, 11, 1, 0, 0, 0, 0, MANILA);
    expect(start.toISOString()).toBe('2026-10-31T16:00:00.000Z');

    const end = zonedTimeToUtc(2026, 11, 30, 23, 59, 59, 999, MANILA);
    expect(end.toISOString()).toBe('2026-11-30T15:59:59.999Z');
  });

  it('uses the Manila calendar month even when the server clock is still on the previous UTC day', () => {
    // 00:30 on 1 Dec 2026 in Manila is still 30 Nov in UTC.
    const now = new Date('2026-11-30T16:30:00.000Z');
    const month = currentBusinessMonthRange(now, MANILA);

    expect(month.label).toBe('December 2026');
    expect(month.startDate).toBe('2026-11-30T16:00:00.000Z');
    expect(month.endDate).toBe('2026-12-31T15:59:59.999Z');
  });

  it('includes the whole selected day when the end instant is Manila midnight', () => {
    // A date picker in Manila sets 30 Nov 00:00, which serializes to the previous UTC evening.
    const range = parseRange(
      '2026-10-31T16:00:00.000Z',
      '2026-11-29T16:00:00.000Z',
      MANILA,
    );

    expect(range.startDate).toBe('2026-10-31T16:00:00.000Z');
    expect(range.endDate).toBe('2026-11-30T15:59:59.999Z');
  });

  it('leaves an explicit end-of-day instant unchanged', () => {
    const range = parseRange(
      '2026-10-31T16:00:00.000Z',
      '2026-11-30T15:59:59.999Z',
      MANILA,
    );

    expect(range.endDate).toBe('2026-11-30T15:59:59.999Z');
  });

  it('treats a date-only end as the end of that Manila day', () => {
    const range = parseRange('2026-11-01', '2026-11-30', MANILA);
    expect(range.startDate).toBe('2026-10-31T16:00:00.000Z');
    expect(range.endDate).toBe('2026-11-30T15:59:59.999Z');
  });

  it('rejects an end date before the start date', () => {
    expect(() => parseRange('2026-11-30', '2026-11-01', MANILA)).toThrow(
      BadRequestException,
    );
  });

  it('rejects a missing or unparseable date', () => {
    expect(() => parseRange(undefined, '2026-11-30', MANILA)).toThrow(
      BadRequestException,
    );
    expect(() => parseRange('2026-11-01', 'yesterday', MANILA)).toThrow(
      BadRequestException,
    );
    expect(() => parseRange('2026-02-31', '2026-03-01', MANILA)).toThrow(
      BadRequestException,
    );
  });
});
