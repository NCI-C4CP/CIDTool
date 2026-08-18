/**
 * Spreadsheet export tests
 *
 * structureFiles turns stored concepts back into the denormalized grid the
 * importer expects, so a round trip through export and import must survive.
 */

import { appState } from '../../src/common.js';
import { structureFiles } from '../../src/dictionary.js';

const CONFIG = {
    PRIMARY: [
        { id: 'conceptId', label: 'PRIMARY CID', type: 'concept' },
        { id: 'key', label: 'PRIMARY Key', type: 'text' }
    ],
    SECONDARY: [
        { id: 'conceptId', label: 'SECONDARY CID', type: 'concept' },
        { id: 'key', label: 'SECONDARY Key', type: 'text' },
        { id: 'primaryConceptId', label: 'Primary', type: 'reference', referencesType: 'PRIMARY' }
    ],
    SOURCE: [
        { id: 'conceptId', label: 'SOURCE CID', type: 'concept' },
        { id: 'key', label: 'SOURCE Key', type: 'text' }
    ],
    QUESTION: [
        { id: 'conceptId', label: 'QUESTION CID', type: 'concept' },
        { id: 'key', label: 'QUESTION Key', type: 'text' },
        { id: 'secondaryConceptId', label: 'Secondary', type: 'reference', referencesType: 'SECONDARY' },
        { id: 'sourceConceptId', label: 'Source', type: 'reference', referencesType: 'SOURCE' },
        { id: 'responses', label: 'Responses', type: 'reference', referencesType: 'RESPONSE' }
    ],
    RESPONSE: [
        { id: 'conceptId', label: 'RESPONSE CID', type: 'concept' },
        { id: 'key', label: 'RESPONSE Key', type: 'text' }
    ]
};

// Column layout: two columns per type, in CONCEPT_TYPES order
const COL = {
    PRIMARY_KEY: 0, PRIMARY_CID: 1,
    SECONDARY_KEY: 2, SECONDARY_CID: 3,
    SOURCE_KEY: 4, SOURCE_CID: 5,
    QUESTION_KEY: 6, QUESTION_CID: 7,
    RESPONSE_KEY: 8, RESPONSE_CID: 9
};

const concept = (object_type, conceptID, key, extra = {}) => ({ object_type, conceptID, key, ...extra });

describe('structureFiles', () => {
    beforeEach(() => {
        appState.setState({ config: CONFIG });
    });

    test('builds a header row from the config labels', () => {
        const { data, columnTypes } = structureFiles([]);

        expect(data[0]).toEqual([
            'PRIMARY Key', 'PRIMARY CID',
            'SECONDARY Key', 'SECONDARY CID',
            'SOURCE Key', 'SOURCE CID',
            'QUESTION Key', 'QUESTION CID',
            'RESPONSE Key', 'RESPONSE CID'
        ]);
        expect(columnTypes[COL.PRIMARY_KEY]).toBe('PRIMARY');
        expect(columnTypes[COL.RESPONSE_CID]).toBe('RESPONSE');
    });

    test('emits a row for a primary with no children', () => {
        const { data } = structureFiles([concept('PRIMARY', 1, 'module')]);

        expect(data).toHaveLength(2);
        expect(data[1][COL.PRIMARY_KEY]).toBe('module');
        expect(data[1][COL.PRIMARY_CID]).toBe(1);
        expect(data[1][COL.SECONDARY_KEY]).toBe('');
    });

    test('repeats the parent on a question row so the grid is self-describing', () => {
        const { data } = structureFiles([
            concept('PRIMARY', 1, 'module'),
            concept('SECONDARY', 2, 'section', { primaryConceptId: 1 }),
            concept('QUESTION', 3, 'age', { secondaryConceptId: 2 })
        ]);

        expect(data).toHaveLength(2);
        expect(data[1][COL.PRIMARY_KEY]).toBe('module');
        expect(data[1][COL.SECONDARY_KEY]).toBe('section');
        expect(data[1][COL.QUESTION_KEY]).toBe('age');
    });

    test('places the first response on the question row and the rest below', () => {
        const { data } = structureFiles([
            concept('PRIMARY', 1, 'module'),
            concept('SECONDARY', 2, 'section', { primaryConceptId: 1 }),
            concept('QUESTION', 3, 'age', { secondaryConceptId: 2, responses: [4, 5] }),
            concept('RESPONSE', 4, 'yes'),
            concept('RESPONSE', 5, 'no')
        ]);

        expect(data).toHaveLength(3);
        expect(data[1][COL.QUESTION_KEY]).toBe('age');
        expect(data[1][COL.RESPONSE_KEY]).toBe('yes');

        // Continuation rows carry only the response, matching the import layout
        expect(data[2][COL.RESPONSE_KEY]).toBe('no');
        expect(data[2][COL.QUESTION_KEY]).toBe('');
    });

    test('resolves a source reference onto the question row', () => {
        const { data } = structureFiles([
            concept('PRIMARY', 1, 'module'),
            concept('SECONDARY', 2, 'section', { primaryConceptId: 1 }),
            concept('QUESTION', 3, 'age', { secondaryConceptId: 2, sourceConceptId: 9 }),
            concept('SOURCE', 9, 'survey')
        ]);

        expect(data[1][COL.SOURCE_KEY]).toBe('survey');
        expect(data[1][COL.SOURCE_CID]).toBe(9);
    });

    test('handles a question whose secondary reference is an array', () => {
        const { data } = structureFiles([
            concept('PRIMARY', 1, 'module'),
            concept('SECONDARY', 2, 'section', { primaryConceptId: 1 }),
            concept('QUESTION', 3, 'age', { secondaryConceptId: [2, 7] })
        ]);

        expect(data[1][COL.QUESTION_KEY]).toBe('age');
    });

    test('emits a row for a secondary that has no questions', () => {
        const { data } = structureFiles([
            concept('PRIMARY', 1, 'module'),
            concept('SECONDARY', 2, 'section', { primaryConceptId: 1 })
        ]);

        expect(data).toHaveLength(2);
        expect(data[1][COL.SECONDARY_KEY]).toBe('section');
        expect(data[1][COL.QUESTION_KEY]).toBe('');
    });

    test('appends orphans so no concept is silently dropped from the export', () => {
        const { data } = structureFiles([
            concept('PRIMARY', 1, 'module'),
            concept('QUESTION', 8, 'unparented'),
            concept('RESPONSE', 9, 'dangling')
        ]);

        const exported = data.slice(1).flat();

        expect(exported).toContain('unparented');
        expect(exported).toContain('dangling');
    });

    test('places every concept exactly once', () => {
        const concepts = [
            concept('PRIMARY', 1, 'module'),
            concept('SECONDARY', 2, 'section', { primaryConceptId: 1 }),
            concept('QUESTION', 3, 'age', { secondaryConceptId: 2, sourceConceptId: 9, responses: [4, 5] }),
            concept('RESPONSE', 4, 'yes'),
            concept('RESPONSE', 5, 'no'),
            concept('SOURCE', 9, 'survey')
        ];

        const cids = structureFiles(concepts).data.slice(1).flat().filter(cell => typeof cell === 'number');

        for (const { conceptID } of concepts) {
            expect(cids.filter(cid => cid === conceptID)).toHaveLength(1);
        }
    });

    test('produces only a header row for no concepts', () => {
        expect(structureFiles([]).data).toHaveLength(1);
    });

    test('does not leak the internal _sourceRow marker into the export', () => {
        const { data } = structureFiles([concept('PRIMARY', 1, 'module', { _sourceRow: 42 })]);

        expect(data[1]).not.toContain(42);
    });
});
