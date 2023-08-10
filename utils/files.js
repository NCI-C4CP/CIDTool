export const generateFiles = async (conceptObjects) => {

    const folderHandler = await requestFolderAccess();

    if (!folderHandler) {
        console.error("File system access not granted");
        return;
    }

    conceptObjects.forEach(async conceptObject => {
        const blob = new Blob([JSON.stringify(conceptObject)], { type: "application/json" });
        const name = `${conceptObject.conceptID}.json`;
        const fileHandle = await folderHandler.getFileHandle(name, { create: true });
        const writable = await fileHandle.createWritable();

        await writable.write(blob);
        await writable.close();
    
        console.log(`JSON file "${name}" saved successfully`);
    });

    return;
}

export const readSpreadsheet = async (file) => {

    const data = await file.arrayBuffer();

    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const arrayData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    return arrayData;
}

export const requestFolderAccess = async () => {
    try {
        const handle = await window.showDirectoryPicker();
        return handle;
    } catch (error) {
        console.error("Error requesting directory access:", error);
    }
}