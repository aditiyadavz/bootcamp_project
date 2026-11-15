import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Loading } from './components/Bits.jsx';
import Layout, { PublicLayout } from './components/Layout.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { RealtimeProvider } from './context/Realtime.jsx';
import { homeFor, SessionProvider, useSession } from './context/Session.jsx';
import { ThemeProvider } from './context/Theme.jsx';
import About from './pages/About.jsx';
import AdminAudit from './pages/admin/AdminAudit.jsx';
import AdminBatches from './pages/admin/AdminBatches.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import MentorStudent from './pages/mentor/MentorStudent.jsx';
import MentorStudents from './pages/mentor/MentorStudents.jsx';
import Notifications from './pages/Notifications.jsx';
import Profile from './pages/Profile.jsx';
import Register from './pages/Register.jsx';
import StudentDashboard from './pages/student/StudentDashboard.jsx';
import StudentDocument from './pages/student/StudentDocument.jsx';

// The charts library is large, so it loads only when a coordinator opens the overview.
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview.jsx'));

// Pages for logged-out visitors. Logged-in users are sent to their own home page.
function GuestOnly({ children }) {
  const { user } = useSession();
  return user ? <Navigate to={homeFor(user)} replace /> : children;
}

// Logged-in pages. Each can also be limited to some roles.
function Protected() {
  const { user } = useSession();
  return user ? <Layout /> : <Navigate to="/login" replace />;
}

function Only({ roles }) {
  const { user } = useSession();
  return roles.includes(user.role) ? <Outlet /> : <Navigate to={homeFor(user)} replace />;
}

function AppRoutes() {
  const { user, loading } = useSession();
  if (loading) return <div className="boot"><Loading /></div>;

  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<GuestOnly><Home /></GuestOnly>} />
        <Route path="/about" element={<About />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      </Route>
      <Route element={<Protected />}>
        <Route element={<Only roles={['student']} />}>
          <Route path="/dashboard" element={<StudentDashboard />} />
          <Route path="/documents/:type" element={<StudentDocument />} />
        </Route>
        <Route element={<Only roles={['mentor', 'admin']} />}>
          <Route path="/mentor" element={<MentorStudents />} />
          <Route path="/mentor/students/:id" element={<MentorStudent />} />
        </Route>
        <Route element={<Only roles={['admin']} />}>
          <Route path="/admin" element={<Suspense fallback={<Loading />}><AdminOverview /></Suspense>} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/batches" element={<AdminBatches />} />
          <Route path="/admin/audit" element={<AdminAudit />} />
        </Route>
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to={homeFor(user)} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <SessionProvider>
          <RealtimeProvider>
            <AppRoutes />
          </RealtimeProvider>
        </SessionProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
