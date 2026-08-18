/**
 * loadAllConcepts tests
 *
 * Covers the decisions the loader makes rather than the archive format: when it
 * serves from cache, when it downloads, and what it refuses to cache.
 */

import { jest } from '@jest/globals';
import 'fake-indexeddb/auto';

import { appState } from '../../src/common.js';
import { loadAllConcepts } from '../../src/api.js';
import { clearCachedConcepts, writeCachedConcepts, readCachedConcepts } from '../../src/cache.js';

const CONCEPTS = {
    '111111111.json': { conceptID: 111111111, key: 'alpha', object_type: 'QUESTION' },
    '222222222.json': { conceptID: 222222222, key: 'beta', object_type: 'RESPONSE' }
};

/**
 * Minimal JSZip stand-in returning a GitHub-shaped archive: one wrapper directory
 * containing the concept files.
 */
const fakeZip = (entries) => {
    const files = { 'owner-repo-abc1234/': {} };

    for (const [name, body] of Object.entries(entries)) {
        files[`owner-repo-abc1234/${name}`] = {
            async: async () => (typeof body === 'string' ? body : JSON.stringify(body))
        };
    }

    return { files };
};

describe('loadAllConcepts', () => {
    let downloads;

    beforeEach(async () => {
        await clearCachedConcepts('owner', 'repo');
        downloads = 0;

        appState.setState({
            owner: 'owner',
            repoName: 'repo',
            treeSha: 'tree-1',
            files: Object.keys(CONCEPTS).map(name => ({ name }))
        });

        global.JSZip = { loadAsync: async () => fakeZip(CONCEPTS) };
        global.fetch = jest.fn(async () => {
            downloads += 1;
            return { ok: true, status: 200, blob: async () => 'zip-bytes' };
        });
    });

    afterEach(() => {
        delete global.JSZip;
        delete global.fetch;
    });

    it('downloads and returns every concept on a cold cache', async () => {
        const { concepts, failed, fromCache } = await loadAllConcepts();

        expect(fromCache).toBe(false);
        expect(failed).toEqual([]);
        expect(concepts).toHaveLength(2);
        expect(concepts.map(c => c.key).sort()).toEqual(['alpha', 'beta']);
        expect(downloads).toBe(1);
    });

    it('caches a clean read so the next call needs no download', async () => {
        await loadAllConcepts();
        const second = await loadAllConcepts();

        expect(second.fromCache).toBe(true);
        expect(second.concepts).toHaveLength(2);
        expect(downloads).toBe(1);
    });

    it('downloads again when the tree sha has moved', async () => {
        await loadAllConcepts();
        appState.setState({ treeSha: 'tree-2' });

        const second = await loadAllConcepts();

        expect(second.fromCache).toBe(false);
        expect(downloads).toBe(2);
    });

    it('reports a file missing from the archive without failing the whole load', async () => {
        appState.setState({ files: [...Object.keys(CONCEPTS), 'ghost.json'].map(name => ({ name })) });

        const { concepts, failed } = await loadAllConcepts();

        expect(failed).toEqual(['ghost.json']);
        expect(concepts).toHaveLength(2);
    });

    it('reports a concept that is not valid JSON', async () => {
        global.JSZip = { loadAsync: async () => fakeZip({ ...CONCEPTS, 'broken.json': 'not json' }) };
        appState.setState({ files: [...Object.keys(CONCEPTS), 'broken.json'].map(name => ({ name })) });

        const { concepts, failed } = await loadAllConcepts();

        expect(failed).toEqual(['broken.json']);
        expect(concepts).toHaveLength(2);
    });

    it('does not cache a partial read, so a failure is never remembered as complete', async () => {
        appState.setState({ files: [...Object.keys(CONCEPTS), 'ghost.json'].map(name => ({ name })) });

        await loadAllConcepts();

        expect(await readCachedConcepts('owner', 'repo', 'tree-1')).toBeNull();
    });

    it('normalizes the legacy conceptId spelling on the way out of the archive', async () => {
        global.JSZip = { loadAsync: async () => fakeZip({ '333333333.json': { conceptId: 333333333, key: 'gamma' } }) };
        appState.setState({ files: [{ name: '333333333.json' }] });

        const { concepts } = await loadAllConcepts();

        expect(concepts[0].conceptID).toBe(333333333);
        expect(concepts[0].conceptId).toBeUndefined();
    });

    it('serves a cache entry written by a previous session without downloading', async () => {
        await writeCachedConcepts('owner', 'repo', 'tree-1', [{ conceptID: 1, key: 'preloaded' }]);

        const { concepts, fromCache } = await loadAllConcepts();

        expect(fromCache).toBe(true);
        expect(concepts[0].key).toBe('preloaded');
        expect(downloads).toBe(0);
    });

    it('ignores files that are not JSON', async () => {
        appState.setState({ files: [...Object.keys(CONCEPTS), 'README.md'].map(name => ({ name })) });

        const { concepts, failed } = await loadAllConcepts();

        expect(failed).toEqual([]);
        expect(concepts).toHaveLength(2);
    });
});
