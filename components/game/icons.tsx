import React from 'react';

/** Line icons for the game layer: 24px grid, 1.5px stroke, round caps. */
type IconProps = { className?: string };

const Svg: React.FC<IconProps & { children: React.ReactNode }> = ({ className = 'w-6 h-6', children }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
    {children}
  </svg>
);

export const ScanIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <circle cx="12" cy="12" r="3.25" />
  </Svg>
);

export const FlagIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </Svg>
);

export const PodiumIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M9 20V9h6v11M3 20v-6h6M15 20v-8h6v8M2.5 20h19" />
  </Svg>
);

export const PersonIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5" />
  </Svg>
);

export const CheckIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const CrossIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const ChevronIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

export const ArrowRightIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const RefreshIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" />
  </Svg>
);

export const SearchIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </Svg>
);

export const QuizIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 16.6v.1" />
  </Svg>
);

export const SparkIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
  </Svg>
);

/** Mission status: filled check disc when done, open ring when not. */
export const StatusPip: React.FC<{ done: boolean; label: string }> = ({ done, label }) => (
  <span role="img" aria-label={label} className="mt-0.5 shrink-0">
    {done ? (
      <span className="flex w-6 h-6 items-center justify-center rounded-full bg-primary text-onPrimary">
        <CheckIcon className="w-4 h-4" />
      </span>
    ) : (
      <span className="block w-6 h-6 rounded-full border-[1.5px] border-secondary/60" />
    )}
  </span>
);

export const PlayIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />
  </Svg>
);

export const PauseIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M8 5.5v13M16 5.5v13" strokeWidth={2.5} />
  </Svg>
);

export const ReplayIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.7M4 4v4.7h4.7" />
  </Svg>
);

export const ShareIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </Svg>
);

export const ChatIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 5.5h16v10H9l-5 4z" />
  </Svg>
);
