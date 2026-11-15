import { useNavigate } from 'react-router-dom';
import { api, formatDate, timeAgo } from '../api.js';
import { EmptyState, Loading, PageHeader } from '../components/Bits.jsx';
import Icon from '../components/Icon.jsx';
import { useRealtime } from '../context/Realtime.jsx';
import { useLiveData } from '../hooks/useLiveData.js';

export default function Notifications() {
  const navigate = useNavigate();
  const { setUnread } = useRealtime();
  const { data, error, reload } = useLiveData('/notifications');

  async function open(notification) {
    if (!notification.read) {
      await api(`/notifications/${notification._id}/read`, { method: 'POST' });
      setUnread((count) => Math.max(0, count - 1));
    }
    if (notification.link) navigate(notification.link);
    else reload();
  }

  async function readAll() {
    await api('/notifications/read-all', { method: 'POST' });
    setUnread(0);
    reload();
  }

  if (error) return <p className="notice error">{error}</p>;
  if (!data) return <Loading />;

  return (
    <>
      <PageHeader title="Notifications" subtitle="Uploads, decisions, messages and deadline reminders. New ones arrive instantly.">
        {data.unread > 0 && <button className="button ghost" onClick={readAll}><Icon name="check" size={16} /> Mark all as read</button>}
      </PageHeader>
      <section className="card list-card">
        {data.notifications.length === 0 ? <EmptyState icon="bell" title="You are all caught up">Notifications appear here as things happen.</EmptyState> : (
          <ul className="notifications">
            {data.notifications.map((notification) => (
              <li key={notification._id}>
                <button className={`notification ${notification.read ? '' : 'unread'} ${notification.kind}`} onClick={() => open(notification)}>
                  <span className="notification-icon"><Icon name={notification.kind === 'reminder' ? 'clock' : 'bell'} size={16} /></span>
                  <span className="notification-text">
                    <span>{notification.text}</span>
                    <span className="muted small" title={formatDate(notification.createdAt)}>{timeAgo(notification.createdAt)}</span>
                  </span>
                  {!notification.read && <span className="unread-dot" aria-label="Unread" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
