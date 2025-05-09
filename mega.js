const fs = require('fs');
const { Storage, File } = require('megajs');

const MEGA_EMAIL = process.env.MEGA_EMAIL;
const MEGA_PASSWORD = process.env.MEGA_PASSWORD;

// Connect to MEGA
function connectToMega() {
    return new Storage({
        email: MEGA_EMAIL,
        password: MEGA_PASSWORD
    });
}

// Upload file to MEGA
async function uploadToMega(filePath, fileName) {
    return new Promise((resolve, reject) => {
        const storage = connectToMega();

        storage.on('ready', () => {
            const upload = storage.upload({ name: fileName }, fs.createReadStream(filePath));
            upload.on('complete', file => {
                console.log('📤 File uploaded:', file.name);
                resolve(file);
            });
            upload.on('error', reject);
        });

        storage.on('error', reject);
    });
}

// Download file from MEGA
async function downloadFromMega(fileUrl, outputPath) {
    return new Promise((resolve, reject) => {
        const file = File.fromURL(fileUrl);

        file.loadAttributes((err, file) => {
            if (err) return reject(err);

            const writeStream = fs.createWriteStream(outputPath);
            file.download().pipe(writeStream);

            writeStream.on('finish', () => {
                console.log('📥 File downloaded to:', outputPath);
                resolve(outputPath);
            });

            writeStream.on('error', reject);
        });
    });
}

module.exports = {
    uploadToMega,
    downloadFromMega
};
