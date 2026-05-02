import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import ErrorBoundary from './components/common/ErrorBoundary';
import ProtectedRoute from './components/common/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
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
import NotFound from './pages/NotFound';

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
      {/* Public */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Admin */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRole="admin">
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
        path="/teacher/*"
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

      {/* Student — AnimatePresence page transitions */}
      <Route
        path="/student/*"
        element={
          <ProtectedRoute allowedRole="student">
            <ErrorBoundary>
              <StudentRoutes />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
