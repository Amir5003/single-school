export default function LoadingSpinner({ size = 60 }) {
  return (
    <div
      className="flex items-center justify-center"
      role="status"
      aria-label="Loading"
      style={{ minHeight: size + 16 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 60 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="animate-spin"
      >
        <circle
          cx="30"
          cy="30"
          r="25"
          stroke="#e0e7ff"
          strokeWidth="5"
        />
        <path
          d="M55 30a25 25 0 0 0-25-25"
          stroke="#4f46e5"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
