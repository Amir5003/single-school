import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Layout from '../../components/common/Layout';
import { getStudents, getTeachers, getClasses } from '../../api/admin.api';
import { selectUser } from '../../redux/slices/authSlice';

const QUICK_ACTIONS = [
  { label: 'Manage Students', to: '/admin/students', color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
  { label: 'Manage Teachers', to: '/admin/teachers', color: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
  { label: 'Manage Classes', to: '/admin/classes', color: 'bg-sky-50 text-sky-700 hover:bg-sky-100' },
  { label: 'Timetable', to: '/admin/timetable', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
];

export default function AdminDashboard() {
  const user = useSelector(selectUser);
  const navigate = useNavigate();

  const [counts, setCounts] = useState({ students: '—', teachers: '—', classes: '—' });

  useEffect(() => {
    const fetchCounts = async () => {
      const [studentRes, teacherRes, classRes] = await Promise.allSettled([
        getStudents({ page: 1, limit: 1 }),
        getTeachers(),
        getClasses(),
      ]);

      setCounts({
        students:
          studentRes.status === 'fulfilled'
            ? (studentRes.value?.data?.total ?? 0)
            : '—',
        teachers:
          teacherRes.status === 'fulfilled'
            ? (teacherRes.value?.data?.teachers?.length ?? teacherRes.value?.data?.total ?? 0)
            : '—',
        classes:
          classRes.status === 'fulfilled'
            ? (classRes.value?.data?.classes?.length ?? classRes.value?.data?.total ?? 0)
            : '—',
      });
    };

    fetchCounts();
  }, []);

  const statCards = [
    {
      label: 'Total Students',
      value: counts.students,
      icon: '🎓',
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
    },
    {
      label: 'Total Teachers',
      value: counts.teachers,
      icon: '👩‍🏫',
      bg: 'bg-violet-50',
      text: 'text-violet-700',
    },
    {
      label: 'Total Classes',
      value: counts.classes,
      icon: '🏫',
      bg: 'bg-sky-50',
      text: 'text-sky-700',
    },
  ];

  return (
    <Layout role="admin">
      {/* Greeting */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">
          Welcome back, {user?.name ?? 'Admin'} 👋
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">Here's a quick overview of your school.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`${card.bg} rounded-2xl p-5 flex items-center gap-4`}
          >
            <span className="text-3xl">{card.icon}</span>
            <div>
              <p className={`text-2xl font-bold ${card.text}`}>{card.value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.to}
            onClick={() => navigate(action.to)}
            className={`${action.color} rounded-xl px-4 py-3 text-sm font-medium text-left transition`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </Layout>
  );
}
