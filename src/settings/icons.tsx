const PATHS = {
  welcome: <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  appearance: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.3 0 1.7-1 1.2-2.1-.6-1.2.1-2.4 1.5-2.4H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10" cy="7" r="1" />
      <circle cx="15" cy="7.5" r="1" />
    </>
  ),
  counting: (
    <>
      <circle cx="6" cy="16" r="2.4" />
      <circle cx="11" cy="9" r="2.4" />
      <circle cx="18" cy="7" r="2.4" />
      <path d="M7.8 14.3 9.6 11M13.4 8.4l2.2-.8" />
    </>
  ),
  ai: (
    <>
      <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" />
      <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
  prayer: <path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1z" />,
  behavior: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  stats: <path d="M5 20v-8M12 20V5M19 20v-5" />,
  about: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  update: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />,
};

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden>
      {PATHS[name]}
    </svg>
  );
}
