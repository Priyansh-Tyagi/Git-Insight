import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/repoAnalysis/fetchManifests', () => ({ fetchManifestContents: vi.fn() }));

import { fetchManifestContents } from '../services/repoAnalysis/fetchManifests';
import { detectForRepo } from '../services/repoAnalysis/detectForRepo';

const fetchMock = vi.mocked(fetchManifestContents);
beforeEach(() => {
  fetchMock.mockReset();
});

describe('detectForRepo', () => {
  it('returns [] without any network call when the repo has no manifests', async () => {
    expect(await detectForRepo('t', 'o', 'r', ['README.md', 'main.c'])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('still finds Terraform when there are no manifests', async () => {
    expect(await detectForRepo('t', 'o', 'r', ['main.tf'])).toEqual([{ skill: 'Terraform', via: ['main.tf'] }]);
  });
  it('returns null (unknown), not [], when manifests exist but none could be read', async () => {
    fetchMock.mockResolvedValue({ contents: [], attempted: 2, failed: 2 });
    expect(await detectForRepo('t', 'o', 'r', ['package.json', 'server/package.json'])).toBeNull();
  });
  it('detects from whatever could be read when some files failed', async () => {
    fetchMock.mockResolvedValue({ contents: [{ path: 'package.json', content: '{"dependencies":{"react":"1"}}' }], attempted: 2, failed: 1 });
    expect((await detectForRepo('t', 'o', 'r', ['package.json', 'server/package.json']))!.map((f) => f.skill)).toEqual(['React']);
  });
  it('returns [] (known: nothing recognised) when files were read but contain no known packages', async () => {
    fetchMock.mockResolvedValue({ contents: [{ path: 'package.json', content: '{"dependencies":{"lodash":"4"}}' }], attempted: 1, failed: 0 });
    expect(await detectForRepo('t', 'o', 'r', ['package.json'])).toEqual([]);
  });
  it('passes only the selected manifest paths to the fetcher', async () => {
    fetchMock.mockResolvedValue({ contents: [], attempted: 0, failed: 0 });
    await detectForRepo('t', 'o', 'r', ['package.json', 'node_modules/x/package.json', 'src/a.ts']);
    expect(fetchMock).toHaveBeenCalledWith('t', 'o', 'r', ['package.json']);
  });
});
