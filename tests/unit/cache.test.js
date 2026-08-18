/**
 * Concept cache tests
 *
 * The cache is keyed by tree SHA, so the behaviour that matters is not "does it
 * store things" but "does it refuse to serve content from a different SHA".
 */

import 'fake-indexeddb/auto';

import { readCachedConcepts, writeCachedConcepts, clearCachedConcepts } from '../../src/cache.js';

const CONCEPTS = [
    { conceptID: 111111111, key: 'alpha', object_type: 'QUESTION' },
    { conceptID: 222222222, key: 'beta', object_type: 'RESPONSE' }
];

describe('concept cache', () => {
    beforeEach(async () => {
        await clearCachedConcepts('owner', 'repo');
        await clearCachedConcepts('owner', 'other');
    });

    it('returns null when nothing has been cached', async () => {
        expect(await readCachedConcepts('owner', 'repo', 'sha-1')).toBeNull();
    });

    it('round-trips concepts for a matching sha', async () => {
        await writeCachedConcepts('owner', 'repo', 'sha-1', CONCEPTS);

        expect(await readCachedConcepts('owner', 'repo', 'sha-1')).toEqual(CONCEPTS);
    });

    it('misses when the sha differs, rather than serving stale concepts', async () => {
        await writeCachedConcepts('owner', 'repo', 'sha-1', CONCEPTS);

        expect(await readCachedConcepts('owner', 'repo', 'sha-2')).toBeNull();
    });

    it('misses when no sha is supplied', async () => {
        await writeCachedConcepts('owner', 'repo', 'sha-1', CONCEPTS);

        expect(await readCachedConcepts('owner', 'repo', null)).toBeNull();
        expect(await readCachedConcepts('owner', 'repo', undefined)).toBeNull();
    });

    it('does not write a record when there is no sha to key it by', async () => {
        await writeCachedConcepts('owner', 'repo', null, CONCEPTS);

        expect(await readCachedConcepts('owner', 'repo', 'sha-1')).toBeNull();
    });

    it('replaces the previous entry when the sha moves on', async () => {
        await writeCachedConcepts('owner', 'repo', 'sha-1', CONCEPTS);
        await writeCachedConcepts('owner', 'repo', 'sha-2', [CONCEPTS[0]]);

        expect(await readCachedConcepts('owner', 'repo', 'sha-1')).toBeNull();
        expect(await readCachedConcepts('owner', 'repo', 'sha-2')).toEqual([CONCEPTS[0]]);
    });

    it('keeps repositories separate', async () => {
        await writeCachedConcepts('owner', 'repo', 'shared-sha', CONCEPTS);
        await writeCachedConcepts('owner', 'other', 'shared-sha', [CONCEPTS[1]]);

        expect(await readCachedConcepts('owner', 'repo', 'shared-sha')).toEqual(CONCEPTS);
        expect(await readCachedConcepts('owner', 'other', 'shared-sha')).toEqual([CONCEPTS[1]]);
    });

    it('clears an entry', async () => {
        await writeCachedConcepts('owner', 'repo', 'sha-1', CONCEPTS);
        await clearCachedConcepts('owner', 'repo');

        expect(await readCachedConcepts('owner', 'repo', 'sha-1')).toBeNull();
    });

    it('degrades to a miss instead of throwing when IndexedDB is unavailable', async () => {
        const realIndexedDB = global.indexedDB;
        global.indexedDB = { open: () => { throw new Error('blocked'); } };

        try {
            await expect(readCachedConcepts('owner', 'repo', 'sha-1')).resolves.toBeNull();
            await expect(writeCachedConcepts('owner', 'repo', 'sha-1', CONCEPTS)).resolves.toBeUndefined();
            await expect(clearCachedConcepts('owner', 'repo')).resolves.toBeUndefined();
        } finally {
            global.indexedDB = realIndexedDB;
        }
    });
});
