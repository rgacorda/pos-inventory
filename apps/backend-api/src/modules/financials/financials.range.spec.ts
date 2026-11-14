import { BadRequestException } from '@nestjs/common';
import {
  assembleTrend,
  businessCalendarDay,
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

  it('keeps the full Manila calendar day, including the evening', () => {
    // 9:28 PM on 14 Nov 2026 in Manila.
    const evening = new Date('2026-11-14T13:28:00.000Z');
    expect(businessCalendarDay(evening, 0, MANILA)).toEqual({
      date: '2026-11-14',
      start: '2026-11-14 00:00:00',
      end: '2026-11-15 00:00:00',
    });
    expect(businessCalendarDay(evening, -1, MANILA)).toEqual({
      date: '2026-11-13',
      start: '2026-11-13 00:00:00',
      end: '2026-11-14 00:00:00',
    });

    // 12:30 AM on 15 Nov in Manila is still 14 Nov in UTC.
    const afterMidnight = new Date('2026-11-14T16:30:00.000Z');
    expect(businessCalendarDay(afterMidnight, 0, MANILA).date).toBe(
      '2026-11-15',
    );

    const firstOfMonth = new Date('2026-11-01T13:00:00.000Z');
    expect(businessCalendarDay(firstOfMonth, -1, MANILA).date).toBe(
      '2026-10-31',
    );
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

  it('groups a three-month span by month and keeps quiet months', () => {
    const trend = assembleTrend(
      new Date('2026-08-10T16:00:00.000Z'),
      new Date('2026-11-11T15:59:59.999Z'),
      {
        '2026-08-15': 100,
        '2026-09-02': 40.5,
        '2026-09-03': 9.5,
      },
      {
        '2026-08-20': 70,
        '2026-11-02': 20,
      },
      {
        '2026-08-16': 40,
        '2026-09-02': 10,
      },
      MANILA,
    );

    expect(trend.bucket).toBe('month');
    expect(trend.points.map((point) => point.date)).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
    expect(trend.points.map((point) => point.revenue)).toEqual([100, 50, 0, 0]);
    expect(trend.points.map((point) => point.purchases)).toEqual([70, 0, 0, 20]);
    expect(trend.points.map((point) => point.cogs)).toEqual([40, 10, 0, 0]);
    expect(trend.points.map((point) => point.profit)).toEqual([60, 40, 0, 0]);
    expect(trend.points[0].label).toBe('Aug 2026');
  });

  it('uses one point per day for a short period and fills days with no activity', () => {
    const trend = assembleTrend(
      new Date('2026-10-31T16:00:00.000Z'),
      new Date('2026-11-03T15:59:59.999Z'),
      { '2026-11-01': 25 },
      { '2026-11-03': 10 },
      { '2026-11-03': 10 },
      MANILA,
    );

    expect(trend.bucket).toBe('day');
    expect(trend.points.map((point) => point.date)).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ]);
    expect(trend.points[1]).toMatchObject({
      revenue: 0,
      purchases: 0,
      profit: 0,
    });
    expect(trend.points[2].profit).toBe(-10);
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
