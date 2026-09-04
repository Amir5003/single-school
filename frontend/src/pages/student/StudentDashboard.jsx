import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import Layout from '../../components/common/Layout';
import { getProfile, getAttendance, getCoursework, getStudentAnnouncements } from '../../api/student.api';
import useApi from '../../hooks/useApi';
import useAuth from '../../hooks/useAuth';
import { staggerContainer, fadeInUp, getVariants } from '../../utils/animationVariants';
import calculatePercentage from '../../utils/calculatePercentage';
import { assessmentTypeLabel } from '../../utils/assessmentTypes';
import FeesCard from '../../components/student/FeesCard';
import HomeworkCard from '../../components/student/HomeworkCard';
import NotificationsPanel from '../../components/student/NotificationsPanel';
import { getStudentFees } from '../../api/fee.api';
import { getStudentHomework } from '../../api/homework.api';
import { selectSchoolBranding } from '../../redux/slices/schoolSlice';
import { selectSchoolName } from '../../redux/slices/schoolSlice';
import { selectSchoolSlug } from '../../redux/slices/authSlice';

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function SummaryCard({ label, value, sub, linkTo }) {
  const branding = useSelector(selectSchoolBranding);
  const inner = (
    <motion.div
      variants={fadeInUp}
      className={`backdrop-blur-sm bg-white/70 rounded-2xl shadow-lg border border-white/20 p-5 flex flex-col gap-1 hover:shadow-xl transition-shadow ${linkTo ? 'cursor-pointer' : ''}`}
    >
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-extrabold" style={{ color: branding?.primaryColor ?? '#4f46e5' }}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </motion.div>
  );

  return linkTo ? <Link to={linkTo}>{inner}</Link> : inner;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const branding = useSelector(selectSchoolBranding);
  const schoolSlug = useSelector(selectSchoolSlug);
  const base = schoolSlug ? `/schools/${schoolSlug}` : '';

  const profile = useApi(getProfile);
  const attendance = useApi(getAttendance);
  const marks = useApi(getCoursework);
  const announcements = useApi(getStudentAnnouncements);
  const fees = useApi(getStudentFees);
  const homework = useApi(getStudentHomework);

  useEffect(() => {
    profile.execute();
    attendance.execute();
    marks.execute();
    announcements.execute();
    fees.execute();
    homework.execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attendancePct = attendance.data?.data?.percentage ?? '—';
  // Coursework comes back grouped by subject; flatten and take the most recent.
  const latestMark = (marks.data?.data?.subjects ?? [])
    .flatMap((g) => g.entries)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const announcementCount = announcements.data?.data?.announcements?.length ?? 0;

  const staggerProps = getVariants(staggerContainer);

  return (
    <Layout role="student">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="max-w-4xl"
      >
        {/* Greeting banner */}
        <motion.div
          variants={fadeInUp}
          className="border-l-4 pl-4 py-2 mb-8"
          style={{ borderColor: branding?.primaryColor ?? '#4f46e5' }}
        >
          <h1 className="text-2xl font-bold text-gray-900">
            Good {getTimeOfDay()}, {(profile.data?.data?.name ?? user?.name ?? 'Student').split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
            {profile.data?.data?.classId?.name ? ` · Class: ${profile.data.data.classId.name}` : ''}
          </p>
        </motion.div>

        {/* Summary cards */}
        <motion.div
          variants={staggerContainer}
          {...staggerProps}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
        >
          <SummaryCard
            label="Attendance"
            value={attendancePct !== '—' ? `${attendancePct}%` : '—'}
            sub="Overall percentage"
            linkTo={`${base}/student/attendance`}
            />
          <SummaryCard
            label="Latest Score"
            value={
              latestMark
                ? `${latestMark.marksObtained}/${latestMark.maxMarks ?? 100}`
                : '—'
            }
            sub={
              latestMark
                ? `${latestMark.subject} · ${latestMark.title}`
                : 'No coursework yet'
            }
            linkTo={`${base}/student/coursework`}
          />
          <SummaryCard
            label="Timetable"
            value="View"
            sub="Your weekly schedule"
            linkTo={`${base}/student/timetable`}
          />
          <SummaryCard
            label="Announcements"
            value={announcementCount}
            sub="Active announcements"
            linkTo={`${base}/student/announcements`}
          />
        </motion.div>

        {/* Quick nav */}
        <motion.div variants={fadeInUp} className="flex flex-wrap gap-3">
          {[
            { label: 'My Profile', to: `${base}/student/profile` },
            { label: 'Timetable', to: `${base}/student/timetable` },
            { label: 'Attendance', to: `${base}/student/attendance` },
            { label: 'Coursework', to: `${base}/student/coursework` },
            { label: 'Announcements', to: `${base}/student/announcements` },
          ].map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
            >
              {label}
            </Link>
          ))}
        </motion.div>

        {/* Fees */}
        {fees.data?.data?.fees?.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Recent Fees</h2>
            <div className="space-y-3">
              {fees.data.data.fees.slice(0, 3).map((fee) => (
                <FeesCard key={fee._id} fee={fee} />
              ))}
            </div>
          </div>
        )}

        {/* Homework */}
        {homework.data?.data?.homework?.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Homework</h2>
            <div className="space-y-3">
              {homework.data.data.homework.slice(0, 3).map((hw) => (
                <HomeworkCard key={hw._id} homework={hw} />
              ))}
            </div>
          </div>
        )}

        {/* Notifications */}
        <div className="mt-8">
          <NotificationsPanel />
        </div>
      </motion.div>
    </Layout>
  );
}
