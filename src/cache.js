/**
 * Local cache of whole-repository concept data, keyed by the repository's tree SHA.
 *
 * A tree SHA changes only when file content changes, so a hit means the cached
 * concepts are byte-identical to what the archive would return. One record is kept
 * per repository: a new SHA overwrites the old one rather than accumulating.
 */

const DB_NAME = 'cidtool';
const DB_VERSION = 1;
const STORE = 'repoConcepts';

/**
 * Opens the cache database, creating the object store on first use
 * @returns {Promise<IDBDatabase>} Open database handle
 */
const openDb = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: 'repo' });
        }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

/**
 * Runs a single-store transaction and resolves with its result
 * @param {string} mode - Transaction mode, 'readonly' or 'readwrite'
 * @param {Function} run - Receives the object store, returns an IDBRequest
 * @returns {Promise<any>} Result of the request, once the transaction commits
 */
const withStore = async (mode, run) => {
    const db = await openDb();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, mode);
            const request = run(tx.objectStore(STORE));
            let result;

            request.onsuccess = () => { result = request.result; };
            // Resolve on commit, not on request success: a write is not durable until then
            tx.oncomplete = () => resolve(result);
            tx.onabort = () => reject(tx.error);
            tx.onerror = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
};

/**
 * Builds the per-repository record key
 * @param {string} owner - Repository owner
 * @param {string} repoName - Repository name
 * @returns {string} Record key
 */
const repoKey = (owner, repoName) => `${owner}/${repoName}`;

/**
 * Reads cached concepts, but only if they match the expected tree SHA
 * @param {string} owner - Repository owner
 * @param {string} repoName - Repository name
 * @param {string} sha - Tree SHA the caller expects
 * @returns {Promise<Array<Object>|null>} Cached concepts, or null on miss
 */
export const readCachedConcepts = async (owner, repoName, sha) => {
    if (!sha) return null;

    try {
        const record = await withStore('readonly', store => store.get(repoKey(owner, repoName)));
        return record && record.sha === sha ? record.concepts : null;
    } catch (error) {
        // A cache that cannot be read is not an error worth interrupting the user for
        console.warn('Concept cache read failed:', error);
        return null;
    }
};

/**
 * Stores concepts for a repository, replacing any previous entry
 * @param {string} owner - Repository owner
 * @param {string} repoName - Repository name
 * @param {string} sha - Tree SHA the concepts were read at
 * @param {Array<Object>} concepts - Concept objects to cache
 * @returns {Promise<void>} Resolves when written, or on a swallowed failure
 */
export const writeCachedConcepts = async (owner, repoName, sha, concepts) => {
    if (!sha) return;

    try {
        await withStore('readwrite', store => store.put({
            repo: repoKey(owner, repoName),
            sha,
            concepts,
            cachedAt: Date.now()
        }));
    } catch (error) {
        // Quota exceeded is the expected failure here, and it is survivable
        console.warn('Concept cache write failed:', error);
    }
};

/**
 * Drops the cached entry for a repository
 * @param {string} owner - Repository owner
 * @param {string} repoName - Repository name
 * @returns {Promise<void>} Resolves when cleared, or on a swallowed failure
 */
export const clearCachedConcepts = async (owner, repoName) => {
    try {
        await withStore('readwrite', store => store.delete(repoKey(owner, repoName)));
    } catch (error) {
        console.warn('Concept cache clear failed:', error);
    }
};
