import { Routes, Route, Navigate, useLocation, useParams, Outlet } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import ErrorBoundary from './components/common/ErrorBoundary';
import ProtectedRoute from './components/common/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import SchoolLanding from './pages/SchoolLanding';
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentsPage from './pages/admin/StudentsPage';
import TeachersPage from './pages/admin/TeachersPage';
import ClassesPage from './pages/admin/ClassesPage';
import TimetablePage from './pages/admin/TimetablePage';
import PendingUsersPage from './pages/admin/PendingUsersPage';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import AttendancePage from './pages/teacher/AttendancePage';
import MarksPage from './pages/teacher/MarksPage';
import AnnouncementsPage from './pages/teacher/AnnouncementsPage';
import StudentDashboard from './pages/student/StudentDashboard';
import ProfilePage from './pages/student/ProfilePage';
import StudentTimetablePage from './pages/student/TimetablePage';
import StudentAttendancePage from './pages/student/AttendancePage';
import StudentMarksPage from './pages/student/MarksPage';
import StudentAnnouncementsPage from './pages/student/AnnouncementsPage';
import SchoolsList from './pages/platform/SchoolsList';
import SchoolDetail from './pages/platform/SchoolDetail';
import PendingRegistrations from './pages/platform/PendingRegistrations';
import ParentDashboard from './pages/parent/ParentDashboard';
import ChildDetail from './pages/parent/ChildDetail';
import NotFound from './pages/NotFound';
import SchoolBrandingProvider from './components/common/SchoolBrandingProvider';
import { getSchoolConfig } from './api/school.api';
import { setSchoolConfig } from './redux/slices/schoolSlice';

/**
 * SchoolContextLoader — fetches and dispatches school config before rendering
 * any child route under /schools/:slug/
 */
function SchoolContextLoader() {
  const { slug } = useParams();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!slug) return;
    getSchoolConfig(slug)
      .then(({ data }) => {
        const s = data.data?.school ?? data.data;
        dispatch(setSchoolConfig({ slug: s.slug, name: s.name, branding: s.branding }));
      })
      .catch(() => {
        // 404 is handled by SchoolLanding; other errors fail silently here
      });
  }, [slug, dispatch]);

  return (
    <SchoolBrandingProvider>
      <Outlet />
    </SchoolBrandingProvider>
  );
}

function StudentRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<StudentDashboard />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="timetable" element={<StudentTimetablePage />} />
        <Route path="attendance" element={<StudentAttendancePage />} />
        <Route path="marks" element={<StudentMarksPage />} />
        <Route path="announcements" element={<StudentAnnouncementsPage />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public — outside school slug */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Platform — super-admin only, no slug */}
      <Route
        path="/platform/*"
        element={
          <ProtectedRoute allowedRole="super-admin">
            <ErrorBoundary>
              <Routes>
                <Route index element={<Navigate to="schools" replace />} />
                <Route path="schools" element={<SchoolsList />} />
                <Route path="schools/:id" element={<SchoolDetail />} />
                <Route path="pending" element={<PendingRegistrations />} />
              </Routes>
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />

      {/* School-scoped routes nested under /schools/:slug/ */}
      <Route path="/schools/:slug" element={<SchoolContextLoader />}>
        <Route index element={<SchoolLanding />} />
        <Route path="login" element={<Login />} />

        {/* Admin */}
        <Route
          path="admin/*"
          element={
            <ProtectedRoute allowedRole="school-admin">
              <ErrorBoundary>
                <Routes>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="students" element={<StudentsPage />} />
                  <Route path="teachers" element={<TeachersPage />} />
                  <Route path="classes" element={<ClassesPage />} />
                  <Route path="timetable" element={<TimetablePage />} />
                  <Route path="pending-approvals" element={<PendingUsersPage />} />
                </Routes>
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Teacher */}
        <Route
          path="teacher/*"
          element={
            <ProtectedRoute allowedRole="teacher">
              <ErrorBoundary>
                <Routes>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<TeacherDashboard />} />
                  <Route path="attendance" element={<AttendancePage />} />
                  <Route path="marks" element={<MarksPage />} />
                  <Route path="announcements" element={<AnnouncementsPage />} />
                </Routes>
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Student */}
        <Route
          path="student/*"
          element={
            <ProtectedRoute allowedRole="student">
              <ErrorBoundary>
                <StudentRoutes />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Parent */}
        <Route
          path="parent/*"
          element={
            <ProtectedRoute allowedRole="parent">
              <ErrorBoundary>
                <Routes>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<ParentDashboard />} />
                  <Route path="children/:studentId" element={<ChildDetail />} />
                </Routes>
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Legacy role routes kept for backward compatibility */}
      <Route path="/admin/*" element={<Navigate to="/login" replace />} />
      <Route path="/teacher/*" element={<Navigate to="/login" replace />} />
      <Route path="/student/*" element={<Navigate to="/login" replace />} />
      <Route path="/parent/*" element={<Navigate to="/login" replace />} />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
