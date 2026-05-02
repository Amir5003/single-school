/**
 * Simple prev / next pagination control.
 *
 * Props:
 *   page        — current page (1-based)
 *   totalPages  — total page count
 *   onPageChange — (newPage: number) => void
 */
export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-end gap-3 mt-4 text-sm">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        ‹ Prev
      </button>

      <span className="text-gray-500">
        Page <span className="font-semibold text-gray-800">{page}</span> of{' '}
        <span className="font-semibold text-gray-800">{totalPages}</span>
      </span>

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        Next ›
      </button>
    </div>
  );
}
