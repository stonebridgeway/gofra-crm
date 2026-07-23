import type { SVGProps } from "react";

export type CrmIconName =
  | "brand"
  | "home"
  | "clients"
  | "deals"
  | "contacts"
  | "activity"
  | "calendar"
  | "statistics"
  | "chat"
  | "import"
  | "settings"
  | "user"
  | "manager"
  | "chevron-down"
  | "sun"
  | "moon"
  | "system"
  | "more";

type CrmIconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: CrmIconName;
};

export function CrmIcon({ name, className = "", ...props }: CrmIconProps) {
  const paths = (() => {
    switch (name) {
      case "brand":
        return (
          <>
            <rect x="3.75" y="4.75" width="16.5" height="14.5" rx="3" />
            <path d="M8 5v14M16 5v14" />
            <path d="M10.25 5v2.1a1.75 1.75 0 0 0 3.5 0V5M10.25 19v-2.1a1.75 1.75 0 0 1 3.5 0V19" />
          </>
        );
      case "home":
        return (
          <>
            <path d="m4 10 8-6 8 6" />
            <path d="M6.5 9v10h11V9M10 19v-5h4v5" />
          </>
        );
      case "clients":
        return (
          <>
            <rect x="4" y="3.75" width="11" height="16.5" rx="2.25" />
            <path d="M15 9h3a2 2 0 0 1 2 2v9H15M7.5 7.5h1M11 7.5h1M7.5 11h1M11 11h1M7.5 14.5h1M11 14.5h1M8 20v-2.5h3V20" />
          </>
        );
      case "deals":
        return (
          <>
            <path d="m8.7 14.8-1.1 1.1a3 3 0 0 1-4.25-4.25l2.7-2.7a3 3 0 0 1 4.25 0l1 1" />
            <path d="m15.3 9.2 1.1-1.1a3 3 0 0 1 4.25 4.25l-2.7 2.7a3 3 0 0 1-4.25 0l-1-1" />
            <path d="m9 15 6-6" />
          </>
        );
      case "contacts":
        return (
          <>
            <circle cx="9" cy="8" r="3.25" />
            <path d="M3.75 19c.25-3.3 2.25-5.25 5.25-5.25s5 1.95 5.25 5.25" />
            <path d="M15.25 5.4a3 3 0 0 1 0 5.2M16.25 13.9c2.3.55 3.7 2.25 4 5.1" />
          </>
        );
      case "activity":
        return (
          <>
            <circle cx="12" cy="12" r="8.25" />
            <path d="M12 7.5V12l3.15 1.9" />
            <path d="M4.8 5.9 3.4 7.3M19.2 5.9l1.4 1.4" />
          </>
        );
      case "calendar":
        return (
          <>
            <rect x="3.75" y="5.25" width="16.5" height="15" rx="2.5" />
            <path d="M8 3.75v3M16 3.75v3M4 9.25h16" />
            <path d="M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01" strokeWidth="2.5" />
          </>
        );
      case "statistics":
        return (
          <>
            <path d="M4 20V9.5h4V20M10 20V4h4v16M16 20v-7h4v7M3 20.25h18" />
          </>
        );
      case "chat":
        return (
          <>
            <path d="M5.25 17.75 4 21l4.15-1.75c1.15.5 2.45.75 3.85.75 5 0 8.5-3.2 8.5-7.5S17 5 12 5s-8.5 3.2-8.5 7.5c0 2.1.65 3.85 1.75 5.25Z" />
            <path d="M8 12.5h.01M12 12.5h.01M16 12.5h.01" strokeWidth="2.5" />
          </>
        );
      case "import":
        return (
          <>
            <path d="M12 3.75v10.5M8.5 11l3.5 3.5 3.5-3.5" />
            <path d="M5 15.75v2.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2.5" />
          </>
        );
      case "settings":
        return (
          <>
            <path d="M4 7h10M18 7h2M4 17h2M10 17h10M4 12h4M12 12h8" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="8" cy="17" r="2" />
            <circle cx="10" cy="12" r="2" />
          </>
        );
      case "user":
        return (
          <>
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5.25 20c.35-4.15 2.75-6.5 6.75-6.5s6.4 2.35 6.75 6.5" />
          </>
        );
      case "manager":
        return (
          <>
            <circle cx="10.5" cy="8" r="3.25" />
            <path d="M4.5 20c.3-4 2.45-6.25 6-6.25 2.15 0 3.8.8 4.8 2.3" />
            <path d="m18.1 13.2.75 1.55 1.7.25-1.25 1.2.3 1.7-1.5-.8-1.55.8.3-1.7-1.25-1.2 1.75-.25.75-1.55Z" />
          </>
        );
      case "chevron-down":
        return <path d="m7 9.5 5 5 5-5" />;
      case "sun":
        return (
          <>
            <circle cx="12" cy="12" r="3.75" />
            <path d="M12 2.75v2M12 19.25v2M2.75 12h2M19.25 12h2M5.45 5.45l1.4 1.4M17.15 17.15l1.4 1.4M18.55 5.45l-1.4 1.4M6.85 17.15l-1.4 1.4" />
          </>
        );
      case "moon":
        return <path d="M19.25 15.3A8.2 8.2 0 0 1 8.7 4.75 8.25 8.25 0 1 0 19.25 15.3Z" />;
      case "system":
        return (
          <>
            <rect x="3.25" y="4.25" width="17.5" height="12.5" rx="2.25" />
            <path d="M9 20h6M12 16.75V20" />
          </>
        );
      case "more":
        return (
          <>
            <circle cx="5" cy="12" r="1.25" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
            <circle cx="19" cy="12" r="1.25" fill="currentColor" stroke="none" />
          </>
        );
    }
  })();

  return (
    <svg
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      {...props}
    >
      {paths}
    </svg>
  );
}
