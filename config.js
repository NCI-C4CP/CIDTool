export const CLIENT_ID = 'Ov23liu5RSq1PMWSLLqh';
export const REDIRECT_URI = 'https://nci-c4cp.github.io/CIDTool/';
export const CLIENT_ID_LOCAL = 'Ov23liVVaSBQIH0ahnn7';
export const REDIRECT_URI_LOCAL = 'http://localhost:5000/';

export const conceptTemplates = {
    PRIMARY: [
        { id: "conceptId", label: "Concept ID", required: true, type: "concept" },
        { id: "key", label: "Key", required: true, type: "text" }
    ],
    SECONDARY: [
        { id: "conceptId", label: "Concept ID", required: true, type: "concept" },
        { id: "key", label: "Key", required: true, type: "text" },
        { id: "primaryConceptId", label: "Primary Concept ID", required: true, type: "reference", referencesType: "PRIMARY" }
    ],
    SOURCE: [
        { id: "conceptId", label: "Concept ID", required: true, type: "concept" },
        { id: "key", label: "Key", required: true, type: "text" }
    ],
    QUESTION: [
        { id: "conceptId", label: "Concept ID", required: true, type: "concept" },
        { id: "key", label: "Key", required: true, type: "text" },
        { id: "secondaryConceptId", label: "Secondary Concept ID", required: true, type: "reference", referencesType: "SECONDARY" },
        { id: "sourceConceptId", label: "Source Concept ID", required: false, type: "reference", referencesType: "SOURCE" },
        { id: "responses", label: "Responses", required: false, type: "reference", referencesType: "RESPONSE" }
    ],
    RESPONSE: [
        { id: "conceptId", label: "Concept ID", required: true, type: "concept" },
        { id: "key", label: "Key", required: true, type: "text" }
    ]
};