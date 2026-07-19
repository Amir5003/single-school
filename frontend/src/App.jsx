import { Routes, Route, Navigate, useLocation, useParams, Outlet, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import ErrorBoundary from './components/common/ErrorBoundary';
import ProtectedRoute from './components/common/ProtectedRoute';
import LoginModal from './components/common/LoginModal';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import SchoolLanding from './pages/SchoolLanding';
import SchoolNotFoundPage from './pages/SchoolNotFoundPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ChangePassword from './pages/ChangePassword';
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentsPage from './pages/admin/StudentsPage';
import TeachersPage from './pages/admin/TeachersPage';
import ClassesPage from './pages/admin/ClassesPage';
import TimetablePage from './pages/admin/TimetablePage';
import PendingUsersPage from './pages/admin/PendingUsersPage';
import ExamsPage from './pages/admin/ExamsPage';
import ResultEntryPage from './pages/admin/ResultEntryPage';
import ExamDashboardPage from './pages/admin/ExamDashboardPage';
import SchoolSettingsPage from './pages/admin/SchoolSettingsPage';
import FeesPage from './pages/admin/FeesPage';
import BillingPage from './pages/admin/BillingPage';
import FeatureGate from './components/common/FeatureGate';
import { FEATURES } from './utils/features';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import AttendancePage from './pages/teacher/AttendancePage';
import MarksPage from './pages/teacher/MarksPage';
import AnnouncementsPage from './pages/teacher/AnnouncementsPage';
import MyExamsPage from './pages/teacher/MyExamsPage';
import SubmissionEntryPage from './pages/teacher/SubmissionEntryPage';
import StudentDashboard from './pages/student/StudentDashboard';
import ProfilePage from './pages/student/ProfilePage';
import StudentTimetablePage from './pages/student/TimetablePage';
import StudentAttendancePage from './pages/student/AttendancePage';
import StudentMarksPage from './pages/student/MarksPage';
import StudentAnnouncementsPage from './pages/student/AnnouncementsPage';
import ResultsPage from './pages/student/ResultsPage';
import SchoolsList from './pages/platform/SchoolsList';
import SchoolDetail from './pages/platform/SchoolDetail';
import PendingRegistrations from './pages/platform/PendingRegistrations';
import SubscriptionsAnalytics from './pages/platform/SubscriptionsAnalytics';
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
  const navigate = useNavigate();

  useEffect(() => {
    if (!slug) return;
    getSchoolConfig(slug)
      .then(({ data }) => {
        const s = data.data?.school ?? data.data;
        dispatch(setSchoolConfig({ slug: s.slug, name: s.name, branding: s.branding }));
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          navigate('/school-not-found', { replace: true });
        }
        // other errors fail silently
      });
  }, [slug, dispatch, navigate]);

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
        <Route
          path="marks"
          element={
            <FeatureGate feature={FEATURES.EXAMS_RESULTS} role="student">
              <StudentMarksPage />
            </FeatureGate>
          }
        />
        <Route
          path="results"
          element={
            <FeatureGate feature={FEATURES.EXAMS_RESULTS} role="student">
              <ResultsPage />
            </FeatureGate>
          }
        />
        <Route path="announcements" element={<StudentAnnouncementsPage />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <>
      <LoginModal />
      <Routes>
        {/* Public — outside school slug */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/school-not-found" element={<SchoolNotFoundPage />} />

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
                  <Route path="subscriptions" element={<SubscriptionsAnalytics />} />
                </Routes>
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Redirect bare /schools to home — no slug means nothing to show */}
        <Route path="/schools" element={<Navigate to="/" replace />} />

        {/* School-scoped routes nested under /schools/:slug/ */}
        <Route path="/schools/:slug" element={<SchoolContextLoader />}>
          <Route index element={<SchoolLanding />} />
          <Route path="login" element={<Login />} />
          <Route path="change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />

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
                    <Route
                      path="exams"
                      element={
                        <FeatureGate feature={FEATURES.EXAMS_RESULTS}>
                          <ExamsPage />
                        </FeatureGate>
                      }
                    />
                    <Route
                      path="exams/:examId/results"
                      element={
                        <FeatureGate feature={FEATURES.EXAMS_RESULTS}>
                          <ResultEntryPage />
                        </FeatureGate>
                      }
                    />
                    <Route
                      path="exams/:examId/dashboard"
                      element={
                        <FeatureGate feature={FEATURES.EXAMS_RESULTS}>
                          <ExamDashboardPage />
                        </FeatureGate>
                      }
                    />
                    <Route path="pending-approvals" element={<PendingUsersPage />} />
                    <Route path="settings" element={<SchoolSettingsPage />} />
                    <Route path="fees" element={<FeesPage />} />
                    <Route path="billing" element={<BillingPage />} />
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
                    <Route
                      path="marks"
                      element={
                        <FeatureGate feature={FEATURES.EXAMS_RESULTS} role="teacher">
                          <MarksPage />
                        </FeatureGate>
                      }
                    />
                    <Route
                      path="my-exams"
                      element={
                        <FeatureGate feature={FEATURES.EXAMS_RESULTS} role="teacher">
                          <MyExamsPage />
                        </FeatureGate>
                      }
                    />
                    <Route
                      path="submissions/:submissionId"
                      element={
                        <FeatureGate feature={FEATURES.EXAMS_RESULTS} role="teacher">
                          <SubmissionEntryPage />
                        </FeatureGate>
                      }
                    />
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
    </>
  );
}
