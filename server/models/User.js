import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  systemId: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
});

export default mongoose.model('User', userSchema);
