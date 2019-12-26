const { Storage } = require('@google-cloud/storage');
const tar = require('tar');
const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const moment = require('moment');

const keyFilename = 'keyfile.json';
const storage = new Storage({ keyFilename });
let BUCKET_NAME;
const rootFolder = '/tmp';
const downloadFolder = `${rootFolder}/backup`;

/**
 * Get bucket's file system
 * 
 */
async function getFileSystem () {
    try {
        const [files] = await storage.bucket(BUCKET_NAME).getFiles();

        return files;
    } catch (error) {
        console.log(`An error occurred in ${arguments.callee.name}: ${error}`);
        process.exit(1);
    }
};

/**
 * Get bucket's metadata
 *
 */
async function getBucketMetadata () {
    try {
        const [metadata] = await storage.bucket(BUCKET_NAME).getMetadata();

        return metadata;
    } catch (error) {
        console.log(`An error occurred in ${arguments.callee.name}: ${error}`);
        process.exit(1);
    }
}

/**
 * Get metadata of a file/directory
 * 
 * @param {*} filename
 */
async function getFileMetadata (filename) {
    try {
        const [metadata] = await storage
            .bucket(BUCKET_NAME)
            .file(filename)
            .getMetadata();

        return metadata;
    } catch (error) {
        console.log(`\nAn error occurred in ${arguments.callee.name}: ${error}`);
    }
}

/**
 * Download the given file
 * 
 * @param {*} filename 
 * @param {*} options 
 */
async function downloadFile (filename, options) {
    try {
        const [metadata] = await storage
            .bucket(BUCKET_NAME)
            .file(filename)
            .download(options);

        return metadata;
    } catch (error) {
        console.log(`An error occurred in ${arguments.callee.name}: ${error}`);
        process.exit(1);
    }
}

/**
 * Download file system locally
 * 
 */
async function initDownload () {
    try {
        const fileSystem = await getFileSystem();

        if (!fs.existsSync(downloadFolder)) {
            fs.mkdirSync(downloadFolder);
        }

        console.log(`Bucket ${BUCKET_NAME} listing ...`);
        _.forEach(fileSystem, file => console.log(`Filename: ${file.name}`));

        for (const file of fileSystem) {
            // Get File metadata
            const metadata = await getFileMetadata(file.name);

            // If error getting metadata, do not include in download
            if (!metadata) {
                console.log(`Directory/File ${file.name} errored. Will not be included in download.\n`);
                continue;
            }

            // If metadata.id contains '//', empty directory, prune, do not include in download
            if (metadata.id.includes('//')) {
                console.log(`Directory ${file.name} empty. Will not be included in download.\n`);
                continue;
            }

            // If filename ends with '/' consider directory and continue, might be empty directory
            // Valid directory creation handled separately
            if (file.name.endsWith('/')) continue;

            // Directory creation

            // Get Directory name
            const dirname = path.dirname(`${downloadFolder}/${file.name}`);

            // If directory does not exist, create
            if (dirname !== '.' && !fs.existsSync(dirname)) {
                fs.mkdirSync(dirname, { recursive: true });
            }

            // Download file
            const options = {
                destination: `${downloadFolder}/${file.name}`
            };

            await downloadFile(file.name, options);

            console.log(`Downloaded ${file.name} ...`);
        };
    } catch (error) {
        console.log(`An error occurred in ${arguments.callee.name}: ${error}`);
    }
};

/**
 * Create a tarball of the downloaded file system
 * 
 */
function createTarBall () {
    const date = new Date();
    const formattedDate = moment(date).format('YYYY-MM-DD-HH:mm');
    const filename = `${rootFolder}/backup-${formattedDate}`.replace(':', '-');
    const tarball = `${filename}.tar`;

    tar.c({
        // gzip: true,
        file: tarball
    }, [downloadFolder])
        .then(_ => { console.log(`Tarball has been created - ${tarball} ...`) });
};

async function main (bucketName) {
    BUCKET_NAME = bucketName;

    // Init Download
    await initDownload();

    // Create Tarball
    createTarBall();
};

main(...process.argv.slice(2)).catch(error => {
    console.log(`An error occurred: ${error}`)
    process.exit(1);
});