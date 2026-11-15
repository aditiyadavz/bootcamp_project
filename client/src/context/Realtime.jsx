// Live updates. While logged in, the browser keeps a Socket.IO connection open.
// The server pushes "notification" and "changed" messages, and pages reload their data.
import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { useSession } from './Session.jsx';

const RealtimeContext = createContext({ version: 0, unread: 0, connected: false, setUnread: () => {} });
export const useRealtime = () => useContext(RealtimeContext);

export function RealtimeProvider({ children }) {
  const { user } = useSession();
  const showToast = useToast();
  const [version, setVersion] = useState(0); // Goes up whenever data changes on the server.
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      setUnread(0);
      return undefined;
    }
    api('/notifications').then((data) => setUnread(data.unread)).catch(() => {});

    const socket = io();
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('notification', (notification) => {
      const kind = notification.kind === 'reminder' ? 'warning' : /rejected/i.test(notification.text) ? 'error' : 'success';
      showToast(notification.text, kind);
      setUnread((count) => count + 1);
      setVersion((count) => count + 1);
    });
    socket.on('changed', () => setVersion((count) => count + 1));
    return () => socket.disconnect();
  }, [userId, showToast]);

  return (
    <RealtimeContext.Provider value={{ version, unread, setUnread, connected }}>
      {children}
    </RealtimeContext.Provider>
  );
}
