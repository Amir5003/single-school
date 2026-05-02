import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Layout from '../../components/common/Layout';
import { getProfile, getAttendance, getMarks, getStudentAnnouncements } from '../../api/student.api';
import useApi from '../../hooks/useApi';
import useAuth from '../../hooks/useAuth';
import { staggerContainer, fadeInUp, getVariants } from '../../utils/animationVariants';
import calculatePercentage from '../../utils/calculatePercentage';

function SummaryCard({ label, value, sub, linkTo, colour }) {
  const inner = (
    <motion.div
      variants={fadeInUp}
      className={`backdrop-blur-sm bg-white/70 rounded-2xl shadow-lg border border-white/20 p-5 flex flex-col gap-1 hover:shadow-xl transition-shadow ${linkTo ? 'cursor-pointer' : ''}`}
    >
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-extrabold ${colour ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </motion.div>
  );

  return linkTo ? <Link to={linkTo}>{inner}</Link> : inner;
}

export default function StudentDashboard() {
  const { user } = useAuth();

  const profile = useApi(getProfile);
  const attendance = useApi(getAttendance);
  const marks = useApi(getMarks);
  const announcements = useApi(getStudentAnnouncements);

  useEffect(() => {
    profile.execute();
    attendance.execute();
    marks.execute();
    announcements.execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attendancePct = attendance.data?.data?.percentage ?? '—';
  const latestMark = marks.data?.data?.marks?.[0];
  const announcementCount = announcements.data?.data?.length ?? 0;

  const staggerProps = getVariants(staggerContainer);

  return (
    <Layout role="student">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="max-w-4xl"
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {profile.data?.data?.name ?? user?.name ?? 'Student'} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {profile.data?.data?.classId?.name
              ? `Class: ${profile.data.data.classId.name}`
              : "Here's your academic overview"}
          </p>
        </div>

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
            linkTo="/student/attendance"
            colour="text-indigo-700"
          />
          <SummaryCard
            label="Latest Score"
            value={
              latestMark
                ? `${latestMark.marksObtained}/${latestMark.maxMarks ?? 100}`
                : '—'
            }
            sub={latestMark ? `${latestMark.subject} · ${latestMark.examType}` : 'No marks yet'}
            linkTo="/student/marks"
            colour="text-emerald-700"
          />
          <SummaryCard
            label="Timetable"
            value="View"
            sub="Your weekly schedule"
            linkTo="/student/timetable"
            colour="text-sky-700"
          />
          <SummaryCard
            label="Announcements"
            value={announcementCount}
            sub="Active announcements"
            linkTo="/student/announcements"
            colour="text-amber-700"
          />
        </motion.div>

        {/* Quick nav */}
        <motion.div variants={fadeInUp} className="flex flex-wrap gap-3">
          {[
            { label: 'My Profile', to: '/student/profile' },
            { label: 'Timetable', to: '/student/timetable' },
            { label: 'Attendance', to: '/student/attendance' },
            { label: 'Marks', to: '/student/marks' },
            { label: 'Announcements', to: '/student/announcements' },
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
      </motion.div>
    </Layout>
  );
}
