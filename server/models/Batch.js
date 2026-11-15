// A group of students who share one deadline, for example "B.Tech CSE 2026".
import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  deadline: { type: Date, required: true },
}, { timestamps: true });

export default mongoose.model('Batch', batchSchema);
