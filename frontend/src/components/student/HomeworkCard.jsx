import { motion } from 'framer-motion';
import { fadeInUp } from '../../utils/animationVariants';

const HomeworkCard = ({ homework }) => {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="bg-white rounded-lg shadow p-4"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-800">{homework.title}</h3>
        <span className="text-xs text-gray-500">
          Due: {new Date(homework.dueDate).toLocaleDateString()}
        </span>
      </div>

      {homework.description && (
        <p className="text-sm text-gray-600 mb-3">{homework.description}</p>
      )}

      {homework.attachments && homework.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {homework.attachments.map((att, idx) => (
            <a
              key={idx}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 underline hover:text-blue-800"
            >
              {att.filename || `Attachment ${idx + 1}`}
            </a>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default HomeworkCard;
