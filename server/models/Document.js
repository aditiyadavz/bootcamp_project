import mongoose from 'mongoose';

export const DOCUMENT_TYPES = {
  report: 'Final Project Report',
  plagiarism: 'Plagiarism Report',
  certificate: 'Internship Completion Certificate',
};

const documentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: Object.keys(DOCUMENT_TYPES), required: true },
  originalName: { type: String, required: true },
  fileId: { type: mongoose.Schema.Types.ObjectId, required: true }, // The PDF in GridFS.
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  comment: { type: String, default: '' },
  uploadedAt: { type: Date, default: Date.now },
  // Every upload and review is added here, so students can see what happened and when.
  history: [{
    _id: false,
    action: { type: String, required: true },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  }],
});

// A student can have only one document of each type.
documentSchema.index({ user: 1, type: 1 }, { unique: true });

export default mongoose.model('Document', documentSchema);
