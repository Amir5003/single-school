import { motion } from 'framer-motion';
import { scaleIn, staggerContainer, getVariants } from '../../utils/animationVariants';
import formatDate from '../../utils/formatDate';

function AnnouncementCard({ announcement }) {
  return (
    <motion.div
      variants={scaleIn}
      {...getVariants(scaleIn)}
      className="backdrop-blur-sm bg-white/70 rounded-2xl shadow-sm border border-white/20 p-5"
    >
      <div className="flex items-start justify-between gap-4 mb-2">
        <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
          {announcement.title}
        </h3>
        <span className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">
          {formatDate(announcement.publishedAt)}
        </span>
      </div>

      <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
        {announcement.content}
      </p>

      {announcement.teacherId?.userId?.name && (
        <p className="mt-3 text-xs text-indigo-500 font-medium">
          Posted by {announcement.teacherId.userId.name}
        </p>
      )}
    </motion.div>
  );
}

export default function AnnouncementList({ announcements }) {
  const staggerProps = getVariants(staggerContainer);

  if (!announcements?.length) {
    return (
      <p className="text-center text-gray-400 text-sm py-8">
        No announcements yet.
      </p>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      {...staggerProps}
      className="space-y-4"
    >
      {announcements.map((ann) => (
        <AnnouncementCard key={ann._id} announcement={ann} />
      ))}
    </motion.div>
  );
}
