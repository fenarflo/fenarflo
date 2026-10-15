import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconHook = (p: P) => (
  <Svg {...p}>
    <path d="M12 3v4" />
    <path d="M12 7a5 5 0 1 1-5 5" />
    <path d="M7 12l-2.5-2.5" />
    <path d="M7 12l2.5-2.5" />
  </Svg>
);

export const IconCaptions = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M7 14h4" />
    <path d="M13 14h4" />
    <path d="M7 10.5h10" />
  </Svg>
);

export const IconPalette = (p: P) => (
  <Svg {...p}>
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.4 17 3 12 3Z" />
    <circle cx="7.5" cy="11" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="10.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="7.8" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconCopy = (p: P) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
    <path d="M15.5 8.5V6.5A2 2 0 0 0 13.5 4.5h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </Svg>
);

export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const IconArrowRight = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </Svg>
);

export const IconUpload = (p: P) => (
  <Svg {...p}>
    <path d="M12 15V4" />
    <path d="M7.5 8.5L12 4l4.5 4.5" />
    <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
  </Svg>
);

export const IconDownload = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v11" />
    <path d="M7.5 10.5L12 15l4.5-4.5" />
    <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
  </Svg>
);

export const IconShare = (p: P) => (
  <Svg {...p}>
    <path d="M12 15V4" />
    <path d="M8 7.5L12 3.5l4 4" />
    <path d="M8 11H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
  </Svg>
);

export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </Svg>
);

export const IconPlay = (p: P) => (
  <Svg {...p}>
    <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
  </Svg>
);

export const IconPause = (p: P) => (
  <Svg {...p}>
    <rect x="7" y="5.5" width="3.5" height="13" rx="1" fill="currentColor" />
    <rect x="13.5" y="5.5" width="3.5" height="13" rx="1" fill="currentColor" />
  </Svg>
);

export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 7h15" />
    <path d="M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
    <path d="M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7" />
  </Svg>
);

export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Svg>
);

export const IconSparkle = (p: P) => (
  <Svg {...p}>
    <path d="M12 4l1.8 4.7L18.5 10.5l-4.7 1.8L12 17l-1.8-4.7L5.5 10.5l4.7-1.8L12 4Z" />
    <path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
  </Svg>
);

export const IconAlert = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5" />
    <path d="M12 16.3v.2" />
  </Svg>
);

export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);

export const IconRefresh = (p: P) => (
  <Svg {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4.5v4h-4" />
  </Svg>
);

export const IconSummary = (p: P) => (
  <Svg {...p}>
    <path d="M4 6h16" />
    <path d="M4 12h10" />
    <path d="M4 18h6" />
    <path d="M17 15l3 3-3 3" />
  </Svg>
);

export const IconBook = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z" />
    <path d="M9 8h7" />
  </Svg>
);

export const IconScissors = (p: P) => (
  <Svg {...p}>
    <circle cx="6" cy="6.5" r="2.5" />
    <circle cx="6" cy="17.5" r="2.5" />
    <path d="M8.2 7.8 20 18" />
    <path d="M8.2 16.2 20 6" />
  </Svg>
);

export const IconMic = (p: P) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
    <path d="M12 17.5V21" />
  </Svg>
);

export const IconUser = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Svg>
);

export const IconGift = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="8" width="17" height="4" rx="1" />
    <path d="M5 12v8h14v-8" />
    <path d="M12 8v12" />
    <path d="M12 8c-1.5-3-5-3.5-5-1.25C7 8 9 8 12 8Zm0 0c1.5-3 5-3.5 5-1.25C17 8 15 8 12 8Z" />
  </Svg>
);
