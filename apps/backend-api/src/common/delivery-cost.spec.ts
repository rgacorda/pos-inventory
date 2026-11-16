import { isNewestCostUpdate } from './delivery-cost';

const older = {
  id: 'aaaa',
  deliveryDate: '2026-10-01T00:00:00.000Z',
  createdAt: '2026-10-01T01:00:00.000Z',
};

const saving = {
  id: 'bbbb',
  deliveryDate: '2026-11-01T00:00:00.000Z',
  createdAt: '2026-11-01T01:00:00.000Z',
};

describe('delivery cost update', () => {
  it('lets the only delivery set the product cost', () => {
    expect(isNewestCostUpdate(saving, [])).toBe(true);
  });

  it('keeps an older delivery from replacing a later cost', () => {
    expect(isNewestCostUpdate(older, [saving])).toBe(false);
    expect(isNewestCostUpdate(saving, [older, older])).toBe(true);
  });

  it('breaks a same-day tie by when the delivery was recorded', () => {
    const earlierSameDay = {
      ...saving,
      id: 'cccc',
      createdAt: '2026-11-01T00:30:00.000Z',
    };
    const laterSameDay = {
      ...saving,
      id: 'dddd',
      createdAt: '2026-11-01T02:00:00.000Z',
    };

    expect(isNewestCostUpdate(saving, [earlierSameDay])).toBe(true);
    expect(isNewestCostUpdate(saving, [laterSameDay])).toBe(false);
  });

  it('breaks a fully tied stamp by id', () => {
    const lowerId = { ...saving, id: 'aaaa' };
    const higherId = { ...saving, id: 'cccc' };

    expect(isNewestCostUpdate(saving, [lowerId])).toBe(true);
    expect(isNewestCostUpdate(saving, [higherId])).toBe(false);
  });
});
