import { motion } from 'framer-motion';
import { fadeInUp, getVariants } from '../../utils/animationVariants';
import formatDate from '../../utils/formatDate';

export default function ProfileCard({ profile }) {
  const motionProps = getVariants(fadeInUp);

  return (
    <motion.div
      variants={fadeInUp}
      {...motionProps}
      className="backdrop-blur-sm bg-white/70 rounded-2xl shadow-lg border border-white/20 p-6"
    >
      {/* Avatar + Name */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600 select-none">
          {profile?.name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{profile?.name}</h2>
          <span className="inline-block mt-1 px-3 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
            {profile?.enrollmentId ?? '—'}
          </span>
        </div>
      </div>

      {/* Details grid */}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
        <ProfileRow label="Class" value={profile?.classId?.name ?? '—'} />
        <ProfileRow
          label="Date of Birth"
          value={formatDate(profile?.dateOfBirth)}
        />
        <ProfileRow label="Phone" value={profile?.userId?.phone ?? '—'} />
        <ProfileRow label="Email" value={profile?.userId?.email ?? '—'} />
        <ProfileRow
          label="Address"
          value={profile?.address ?? '—'}
          fullWidth
        />
      </dl>
    </motion.div>
  );
}

function ProfileRow({ label, value, fullWidth }) {
  return (
    <div className={fullWidth ? 'col-span-full' : ''}>
      <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">
        {label}
      </dt>
      <dd className="text-gray-800 font-medium break-words">{value}</dd>
    </div>
  );
}
