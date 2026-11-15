// A message between a student and a mentor about one document.
import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const commentSchema = new mongoose.Schema({
  document: { type: ObjectId, ref: 'Document', required: true, index: true },
  author: { type: ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  authorRole: { type: String, required: true },
  text: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('Comment', commentSchema);
