/**
 * Mosque silhouette for the prayer-time note: a pointed dome with a crescent, two
 * minarets with balconies, and arched door and windows cut out in the island colour.
 */
export function Mosque({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 48" aria-hidden>
      <g className="m-body">
        {/* crescent on the dome */}
        <path d="M33.6 1.2a2.4 2.4 0 1 0 0 4.4 1.9 1.9 0 1 1 0-4.4z" />
        {/* dome on its drum */}
        <path d="M20 25.5C19.2 16.5 28 13.6 32 7.2c4 6.4 12.8 9.3 12 18.3z" />
        <rect x="21" y="24.5" width="22" height="4.5" rx="0.8" />
        {/* prayer hall */}
        <rect x="16.5" y="28.5" width="31" height="16" rx="1" />
        {/* minarets: shaft, balcony, cap and finial */}
        <rect x="7.5" y="16" width="5" height="28.5" rx="0.6" />
        <rect x="6" y="24" width="8" height="2" rx="1" />
        <path d="M7.5 16.4 10 8.6l2.5 7.8z" />
        <circle cx="10" cy="7.4" r="0.9" />
        <rect x="51.5" y="16" width="5" height="28.5" rx="0.6" />
        <rect x="50" y="24" width="8" height="2" rx="1" />
        <path d="M51.5 16.4 54 8.6l2.5 7.8z" />
        <circle cx="54" cy="7.4" r="0.9" />
        {/* ground */}
        <rect x="3" y="44" width="58" height="3" rx="1.5" />
      </g>
      <g className="m-cut">
        <path d="M28.6 44.5V38a3.4 3.4 0 0 1 6.8 0v6.5z" />
        <path d="M20.6 38.5v-3.4a1.6 1.6 0 0 1 3.2 0v3.4zM40.2 38.5v-3.4a1.6 1.6 0 0 1 3.2 0v3.4z" />
      </g>
    </svg>
  );
}
