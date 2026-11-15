// Real-time updates with Socket.IO. Each logged-in browser joins a "room" named after its user,
// so the server can push a message to exactly the right people.
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import User from '../models/User.js';

let io = null;

export function attachRealtime(httpServer) {
  io = new Server(httpServer);

  // Only logged-in users may connect. The same login cookie is checked.
  io.use(async (socket, next) => {
    try {
      const { token } = parse(socket.handshake.headers.cookie || '');
      const { userId } = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(userId);
      if (!user?.active) throw new Error('Inactive');
      socket.data.user = user;
      next();
    } catch {
      next(new Error('Please log in.'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;
    socket.join(`user:${user.id}`);
    if (user.role === 'admin') socket.join('admins');
  });

  return io;
}

export function emitToUsers(userIds, event, payload = {}) {
  if (!io) return;
  for (const id of userIds) io.to(`user:${id}`).emit(event, payload);
}

export function emitToAdmins(event, payload = {}) {
  if (io) io.to('admins').emit(event, payload);
}

export function closeRealtime() {
  io?.close();
  io = null;
}
