// ── AttendanceTable ───────────────────────────────────────────────────────────
//
// Props:
//   students  — array of student docs { _id, enrollmentId, userId: { name } }
//   statuses  — { [studentId]: 'Present' | 'Absent' | 'Leave' }
//   onChange  — (studentId, status) => void
//   disabled  — bool (prevents changes while saving)
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['Present', 'Absent', 'Leave'];

const STATUS_STYLES = {
  Present: {
    active: 'bg-emerald-500 text-white border-emerald-500',
    base: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50',
  },
  Absent: {
    active: 'bg-red-500 text-white border-red-500',
    base: 'border-red-200 text-red-600 hover:bg-red-50',
  },
  Leave: {
    active: 'bg-amber-400 text-white border-amber-400',
    base: 'border-amber-200 text-amber-600 hover:bg-amber-50',
  },
};

function StatusButton({ status, selected, onClick, disabled }) {
  const styles = STATUS_STYLES[status];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed ${
        selected ? styles.active : styles.base
      }`}
    >
      {status.charAt(0)}
    </button>
  );
}

export default function AttendanceTable({ students, statuses, onChange, disabled }) {
  if (!students || students.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        No students found in this class.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
            <th className="pb-2 font-medium pr-4">#</th>
            <th className="pb-2 font-medium pr-4">Enroll ID</th>
            <th className="pb-2 font-medium">Name</th>
            <th className="pb-2 font-medium text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student, idx) => {
            const name = student.userId?.name ?? '—';
            const current = statuses[student._id] ?? null;
            return (
              <tr
                key={student._id}
                className="border-b border-gray-50 hover:bg-gray-50/60 transition"
              >
                <td className="py-3 pr-4 text-gray-400">{idx + 1}</td>
                <td className="py-3 pr-4 font-mono text-xs text-gray-500">
                  {student.enrollmentId}
                </td>
                <td className="py-3 text-gray-800 font-medium">{name}</td>
                <td className="py-3 text-right">
                  <div className="flex gap-1.5 justify-end">
                    {STATUS_OPTIONS.map((s) => (
                      <StatusButton
                        key={s}
                        status={s}
                        selected={current === s}
                        onClick={() => onChange(student._id, s)}
                        disabled={disabled}
                      />
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
