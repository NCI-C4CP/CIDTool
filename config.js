export const CLIENT_ID = 'Ov23liu5RSq1PMWSLLqh';
export const REDIRECT_URI = 'https://analyticsphere.github.io/CIDTool/';
export const CLIENT_ID_LOCAL = 'Ov23liVVaSBQIH0ahnn7';
export const REDIRECT_URI_LOCAL = 'http://localhost:5000/';

export const fields = {
    "Primary Source": [
        { label: "Concept ID", id: "concept", type: "text", required: true },
        { label: "Source Name", id: "Primary Source", type: "text", required: true }
    ],
    "Secondary Source": [
        { label: "Concept ID", id: "concept", type: "text", required: true },
        { label: "Source Name", id: "Secondary Source", type: "text", required: true },
        { label: "Primary Source", id: "Primary Source", type: "concept", required: true }
    ],
    "Source Question": [
        { label: "Concept ID", id: "concept", type: "text", required: true },
        { label: "Question Text", id: "Source Question Text", type: "text", required: true },
        { label: "Secondary Source", id: "Secondary Source", type: "text", required: true }
    ],
    "Question": [
        { label: "Concept ID", id: "concept", type: "text", required: true },
        { label: "Question Name", id: "questionName", type: "text" },
        { label: "Variable Label", id: "Variable Label", type: "text", required: true },
        { label: "Variable Name", id: "Variable Name", type: "text", required: true },
        { label: "Question Text", id: "Current Question Text", type: "text", required: true },
        { label: "Variable Type", id: "Variable Type", type: "text", required: true },
        { label: "Variable Length", id: "Variable Length", type: "text", required: true },
        { label: "Responses", id: "Responses", type: "text", required: true }
    ],
    "Response": [
        { label: "Concept ID", id: "concept", type: "text", required: true },
        { label: "Value", id: "Current Value", type: "text", required: true }
    ]
};