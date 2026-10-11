import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { fetchCommitActivity } from '../services/repoAnalysis/fetchRepoTree';

vi.mock('axios');
const get = vi.mocked(axios.get);

describe('fetchCommitActivity', () => {
  beforeEach(() => { get.mockReset(); });

  it('retries on HTTP 202 until stats are ready (regression: cold-cache repos scored activity 0)', async () => {
    get
      .mockResolvedValueOnce({ status: 202, data: {} } as any)
      .mockResolvedValueOnce({ status: 202, data: {} } as any)
      .mockResolvedValueOnce({ status: 200, data: [{ total: 3 }, { total: 4 }] } as any);
    const out = await fetchCommitActivity('o', 'r', {}, 0);
    expect(out).toEqual([3, 4]);
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('returns [] after exhausting retries on persistent 202', async () => {
    get.mockResolvedValue({ status: 202, data: {} } as any);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await fetchCommitActivity('o', 'r', {}, 0, 3)).toEqual([]);
    expect(get).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns [] immediately on a real HTTP error without retrying', async () => {
    get.mockRejectedValueOnce({ response: { status: 403 } });
    const out = await fetchCommitActivity('o', 'r', {}, 0);
    expect(out).toEqual([]);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('does not retry on a normal 200', async () => {
    get.mockResolvedValue({ status: 200, data: [{ total: 9 }] } as any);
    expect(await fetchCommitActivity('o', 'r', {}, 0)).toEqual([9]);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
