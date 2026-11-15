// A permanent record of important actions: who did what, and when.
import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorName: { type: String, required: true },
  action: { type: String, required: true },
  details: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('AuditLog', auditLogSchema);
