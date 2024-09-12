
export const readSpreadsheet = async (file) => {

    const data = await file.arrayBuffer();

    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const arrayData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    return arrayData;
}

export const readFiles = async (files) => {

    let filesArray = [];
    let fileData = [];

    for(let file of files) {
        if(file.type === "application/json") {
            filesArray.push(file);
        }
    }

    const filePromises = filesArray.map((file) => {
    
        return new Promise((resolve, reject) => {
          
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    fileData.push(reader.result);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (error) => {
                reject(error);
            };
            reader.readAsText(file);
        });
    });

    await Promise.all(filePromises);

    for(let i = 0; i < fileData.length; i++) {
        fileData[i] = JSON.parse(fileData[i]);
    }
    return fileData;
}

export const generateSpreadsheet = (data) => {
    
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dictionary');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = 'data.xlsx'; // Default filename
    downloadLink.click();

    // Clean up
    URL.revokeObjectURL(downloadLink.href);
}