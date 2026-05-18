import { motion } from 'framer-motion';
import { fadeInUp } from '../../utils/animationVariants';

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
};

const FeesCard = ({ fee }) => {
  const badge = STATUS_STYLES[fee.status] || 'bg-gray-100 text-gray-800';

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="bg-white rounded-lg shadow p-4 flex justify-between items-start"
    >
      <div>
        <p className="font-semibold text-gray-800">{fee.description}</p>
        <p className="text-sm text-gray-500 mt-1">
          Due: {new Date(fee.dueDate).toLocaleDateString()}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className="text-lg font-bold text-gray-900">₹{fee.amount}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${badge}`}>
          {fee.status}
        </span>
      </div>
    </motion.div>
  );
};

export default FeesCard;
