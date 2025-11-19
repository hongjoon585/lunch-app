import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema({
  actorId: { type: mongoose.Types.ObjectId, default: null },
  action: String,
  targetId: { type: mongoose.Types.ObjectId, default: null },
  meta: mongoose.Schema.Types.Mixed
}, { timestamps: { createdAt: true, updatedAt: false } });

export default mongoose.model('AuditLog', auditSchema);

