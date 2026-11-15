import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const DOCUMENT_TYPES = {
  report: 'Final Project Report',
  plagiarism: 'Plagiarism Report',
  certificate: 'Internship Completion Certificate',
};

// Each upload is kept as a version, so older files can still be opened.
const versionSchema = new mongoose.Schema({
  number: { type: Number, required: true },
  fileId: { type: ObjectId, required: true }, // The PDF stored in GridFS.
  originalName: { type: String, required: true },
  size: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const historySchema = new mongoose.Schema({
  action: { type: String, required: true },
  note: { type: String, default: '' },
  by: { type: String, default: '' },
  at: { type: Date, default: Date.now },
}, { _id: false });

const documentSchema = new mongoose.Schema({
  user: { type: ObjectId, ref: 'User', required: true },
  type: { type: String, enum: Object.keys(DOCUMENT_TYPES), required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  similarity: { type: Number, default: null }, // Plagiarism percentage entered by the mentor.
  versions: [versionSchema],
  history: [historySchema],
}, { timestamps: true });

// A student can have only one document of each type.
documentSchema.index({ user: 1, type: 1 }, { unique: true });

// The shape sent to the browser. File IDs stay on the server.
export function toPublic(document) {
  const versions = document.versions.map(({ number, originalName, size, uploadedAt }) => ({ number, originalName, size, uploadedAt }));
  return {
    _id: document._id,
    user: document.user,
    type: document.type,
    label: DOCUMENT_TYPES[document.type],
    status: document.status,
    similarity: document.similarity,
    latest: versions.at(-1) ?? null,
    versions: versions.reverse(),
    history: document.history,
    updatedAt: document.updatedAt,
  };
}

export default mongoose.model('Document', documentSchema);
