import AuditLog from '../models/AuditLog.js';

export function audit(actor, action, details = '') {
  return AuditLog.create({
    actor: actor?._id ?? null,
    actorName: actor ? `${actor.name} (${actor.systemId})` : 'System',
    action,
    details,
  });
}
