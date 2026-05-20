// ── MarksTable ────────────────────────────────────────────────────────────────
//
// Props:
//   students  — array of { _id, enrollmentId, userId: { name } }
//   marks     — { [studentId]: string }  (controlled by parent)
//   maxMarks  — number (default 100)
//   onChange  — (studentId, value: string) => void
//   disabled  — bool
// ─────────────────────────────────────────────────────────────────────────────

function isInvalid(val, maxMarks) {
  if (!val || val === '') return false;       // empty is allowed (means "no entry")
  const n = Number(val);
  return isNaN(n) || n < 0 || n > maxMarks;
}

export default function MarksTable({ students, marks, maxMarks = 100, onChange, disabled }) {
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
            <th className="pb-2 font-medium text-right">Marks (0 – {maxMarks})</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student, idx) => {
            const name = student.userId?.name ?? '—';
            const val = marks[student._id] ?? '';
            const invalid = isInvalid(val, maxMarks);
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
                  <div className="flex flex-col items-end gap-0.5">
                    <input
                      type="number"
                      min={0}
                      max={maxMarks}
                      step={1}
                      value={val}
                      disabled={disabled}
                      placeholder="—"
                      onChange={(e) => onChange(student._id, e.target.value)}
                      className={`w-24 border rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 disabled:opacity-40 disabled:cursor-not-allowed transition ${
                        invalid
                          ? 'border-red-400 focus:ring-red-200'
                          : 'border-gray-200 focus:ring-indigo-300'
                      }`}
                    />
                    {invalid && (
                      <span className="text-xs text-red-500">0–{maxMarks} only</span>
                    )}
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
