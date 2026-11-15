// Stores PDF files in MongoDB Atlas using GridFS, which splits a file into small chunks.
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import mongoose from 'mongoose';

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'pdfs' });

export async function saveFile(buffer, filename) {
  const upload = bucket().openUploadStream(filename, { contentType: 'application/pdf' });
  await pipeline(Readable.from(buffer), upload);
  return upload.id;
}

export function openFile(fileId) {
  return bucket().openDownloadStream(fileId);
}

export function deleteFile(fileId) {
  return bucket().delete(fileId);
}
