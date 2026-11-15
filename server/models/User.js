import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const userSchema = new mongoose.Schema({
  systemId: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['student', 'mentor', 'admin'], default: 'student' },
  batch: { type: ObjectId, ref: 'Batch', default: null }, // Students only.
  mentor: { type: ObjectId, ref: 'User', default: null }, // Students only.
  extendedDeadline: { type: Date, default: null }, // A personal extension, if given.
  active: { type: Boolean, default: true }, // Deactivated users cannot log in.
}, { timestamps: true });

export default mongoose.model('User', userSchema);
