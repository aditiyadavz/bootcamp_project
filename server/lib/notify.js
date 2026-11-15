// Saves a notification and pushes it to the user's open pages straight away.
import Notification from '../models/Notification.js';
import { emitToAdmins, emitToUsers } from './realtime.js';

export async function notify(userId, text, link = '', kind = 'info') {
  if (!userId) return null;
  const notification = await Notification.create({ user: userId, text, link, kind });
  emitToUsers([userId], 'notification', notification.toObject());
  return notification;
}

// Tells open pages that data changed, so they reload it.
export function announceChange(userIds) {
  emitToUsers(userIds.filter(Boolean), 'changed');
  emitToAdmins('changed');
}
