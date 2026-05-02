export default function EmptyState({ message = 'No data available yet' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <svg
        className="w-16 h-16 text-gray-300 mb-4"
        fill="none"
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="8" y="16" width="48" height="36" rx="4" stroke="currentColor" strokeWidth="2.5" />
        <path d="M8 24h48" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M20 36h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M20 43h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <p className="text-gray-500 text-base font-medium">{message}</p>
    </div>
  );
}
