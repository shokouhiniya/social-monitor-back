import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from './pagination.types';
import {
  normalizePagination,
  paginate,
  paginateArray,
} from './pagination.util';
import { PaginationPipe } from './pagination.pipe';

describe('normalizePagination', () => {
  it('uses defaults when no input is provided', () => {
    const result = normalizePagination();
    expect(result.page).toBe(DEFAULT_PAGE);
    expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(result.skip).toBe(0);
    expect(result.take).toBe(DEFAULT_PAGE_SIZE);
  });

  it('uses defaults when input fields are empty/invalid strings', () => {
    const result = normalizePagination({ page: '', pageSize: 'abc' });
    expect(result.page).toBe(DEFAULT_PAGE);
    expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it('parses numeric strings from query params', () => {
    const result = normalizePagination({ page: '3', pageSize: '50' });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
    expect(result.skip).toBe(100);
    expect(result.take).toBe(50);
  });

  it('clamps pageSize below 1 up to 1', () => {
    expect(normalizePagination({ pageSize: 0 }).pageSize).toBe(MIN_PAGE_SIZE);
    expect(normalizePagination({ pageSize: -5 }).pageSize).toBe(MIN_PAGE_SIZE);
  });

  it('clamps pageSize above 100 down to 100', () => {
    expect(normalizePagination({ pageSize: 101 }).pageSize).toBe(MAX_PAGE_SIZE);
    expect(normalizePagination({ pageSize: 9999 }).pageSize).toBe(MAX_PAGE_SIZE);
  });

  it('clamps page below 1 up to 1', () => {
    expect(normalizePagination({ page: 0 }).page).toBe(1);
    expect(normalizePagination({ page: -10 }).page).toBe(1);
  });

  it('truncates fractional inputs to integers', () => {
    const result = normalizePagination({ page: 2.9, pageSize: 30.7 });
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(30);
  });
});

describe('paginate', () => {
  it('returns the standard shape and echoes effective page/pageSize', () => {
    const pagination = normalizePagination({ page: 2, pageSize: 10 });
    const items = Array.from({ length: 10 }, (_, i) => i);
    const result = paginate(items, 35, pagination);

    expect(result).toEqual({
      items,
      total: 35,
      page: 2,
      pageSize: 10,
    });
  });

  it('never returns more items than pageSize', () => {
    const pagination = normalizePagination({ pageSize: 5 });
    const items = Array.from({ length: 20 }, (_, i) => i);
    const result = paginate(items, 100, pagination);
    expect(result.items.length).toBeLessThanOrEqual(result.pageSize);
    expect(result.items.length).toBe(5);
  });

  it('keeps total >= items.length even when total is understated', () => {
    const pagination = normalizePagination({ pageSize: 10 });
    const items = [1, 2, 3];
    const result = paginate(items, 0, pagination);
    expect(result.total).toBeGreaterThanOrEqual(result.items.length);
    expect(result.total).toBe(3);
  });

  it('never returns a negative total', () => {
    const pagination = normalizePagination();
    const result = paginate([], -50, pagination);
    expect(result.total).toBe(0);
  });
});

describe('paginateArray', () => {
  it('slices the correct page out of an in-memory dataset', () => {
    const dataset = Array.from({ length: 25 }, (_, i) => i);
    const pagination = normalizePagination({ page: 3, pageSize: 10 });
    const result = paginateArray(dataset, pagination);

    expect(result.total).toBe(25);
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(10);
    expect(result.items).toEqual([20, 21, 22, 23, 24]);
  });

  it('produces non-overlapping pages that cover the whole dataset', () => {
    const dataset = Array.from({ length: 23 }, (_, i) => i);
    const page1 = paginateArray(dataset, normalizePagination({ page: 1, pageSize: 10 }));
    const page2 = paginateArray(dataset, normalizePagination({ page: 2, pageSize: 10 }));
    const page3 = paginateArray(dataset, normalizePagination({ page: 3, pageSize: 10 }));

    const combined = [...page1.items, ...page2.items, ...page3.items];
    expect(combined).toEqual(dataset);
    expect(new Set(combined).size).toBe(dataset.length);
  });
});

describe('PaginationPipe', () => {
  const pipe = new PaginationPipe();

  it('transforms raw query into normalized pagination', () => {
    const result = pipe.transform({ page: '4', pageSize: '200' });
    expect(result.page).toBe(4);
    expect(result.pageSize).toBe(MAX_PAGE_SIZE);
    expect(result.skip).toBe(3 * MAX_PAGE_SIZE);
    expect(result.take).toBe(MAX_PAGE_SIZE);
  });

  it('handles undefined input gracefully', () => {
    const result = pipe.transform(undefined as never);
    expect(result.page).toBe(DEFAULT_PAGE);
    expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });
});
