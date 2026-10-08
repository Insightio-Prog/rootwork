import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 19, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function BrandMark({ size = 19 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-bg)"
      strokeWidth={2.75}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="2.4" />
      <circle cx="5.5" cy="19" r="2.4" />
      <circle cx="18.5" cy="19" r="2.4" />
      <path d="M12 7.4v4.2M5.5 16.6v-2.4h13v2.4" />
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.6V21h13V9.6" />
    </Icon>
  );
}

export function IconTree(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="5" r="2.2" />
      <circle cx="5.5" cy="19" r="2.2" />
      <circle cx="18.5" cy="19" r="2.2" />
      <path d="M12 7.2v4.3M5.5 16.8v-2.4h13v2.4" />
    </Icon>
  );
}

export function IconStory(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 5.5h6.5A3.5 3.5 0 0 1 15 9v10.5H8.5A3.5 3.5 0 0 0 5 16V5.5z" />
      <path d="M19 5.5h-6.5A3.5 3.5 0 0 0 9 9v10.5h6.5A3.5 3.5 0 0 1 19 16V5.5z" />
    </Icon>
  );
}

export function IconTimeline(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4v16" />
      <path d="M8 7.5h9M8 12h12M8 16.5h7" />
    </Icon>
  );
}

export function IconMap(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </Icon>
  );
}

export function IconDna(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 3c0 7 12 11 12 18" />
      <path d="M18 3c0 7-12 11-12 18" />
      <path d="M8.5 7h7M8.5 17h7" />
    </Icon>
  );
}

export function IconLists(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6.5h16M4 12h16M4 17.5h10" />
    </Icon>
  );
}

export function IconMedia(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="4" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4.5 17l4.7-4.2 4 3.4 2.6-2.2 3.6 3" />
    </Icon>
  );
}

export function IconFolder(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 8.5V18a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V10.5a1.5 1.5 0 0 0-1.5-1.5H12L9.7 6.4A1.5 1.5 0 0 0 8.5 6H5.5A2 2 0 0 0 3.5 8.5Z" />
    </Icon>
  );
}

export function IconHistory(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </Icon>
  );
}

export function IconBookmarks(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 4.5h12v15l-6-4.2-6 4.2z" />
    </Icon>
  );
}

export function IconTasks(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h4M4 12h4M4 17h4" />
      <path d="M12 7h8M12 12h8M12 17h8" />
    </Icon>
  );
}

export function IconReports(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 3.5h7.5L18.5 8v12.5h-12z" />
      <path d="M9.5 12h6M9.5 16h4" />
    </Icon>
  );
}

export function IconAsk(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 6.5h14a2 2 0 0 1 2 2V16a2 2 0 0 1-2 2h-6l-4 3.2V18H5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2z" />
    </Icon>
  );
}

export function IconExport(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M5 19.5h14" />
    </Icon>
  );
}

export function IconBell(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10z" />
      <path d="M10.5 19a1.8 1.8 0 0 0 3 0" />
    </Icon>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </Icon>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function IconMinus(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
    </Icon>
  );
}

export function IconBack(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 12H5" />
      <path d="M11 6 5 12l6 6" />
    </Icon>
  );
}

export function IconEye(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.4 12s3.6-7 9.6-7 9.6 7 9.6 7-3.6 7-9.6 7-9.6-7-9.6-7z" />
      <circle cx="12" cy="12" r="2.6" />
    </Icon>
  );
}

export function IconPanel(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="4" />
      <path d="M13 5v14" />
    </Icon>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </Icon>
  );
}

export function IconClose(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function IconPencil(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15.5 4.5 19.5 8.5 8.5 19.5H4.5v-4z" />
    </Icon>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16" />
      <path d="M9.5 7V5.2A1.7 1.7 0 0 1 11.2 3.5h1.6A1.7 1.7 0 0 1 14.5 5.2V7" />
      <path d="M6.5 7 7.4 19.5h9.2L17.5 7" />
      <path d="M10 11v5.5M14 11v5.5" />
    </Icon>
  );
}

export function IconChevron(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9.5 6 6 6-6 6" />
    </Icon>
  );
}

export function IconCamera(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8.5h3.2l1.4-2h6.8l1.4 2H20v10H4z" />
      <circle cx="12" cy="13.2" r="3.1" />
    </Icon>
  );
}

export function IconDocument(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 3.5h7l5 5V20.5H7z" />
      <path d="M14 3.5V9h5" />
    </Icon>
  );
}

export function IconLink(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 13a5 5 0 0 0 7.54.54l1.42-1.42a5 5 0 0 0-7.07-7.07L10.7 6.64" />
      <path d="M14 11a5 5 0 0 0-7.54-.54L5.04 11.9a5 5 0 0 0 7.07 7.07L13.3 17.36" />
    </Icon>
  );
}

export function IconParents(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 6.5a3 3 0 0 1 0 5.5M17.5 19c0-2.2-.7-3.6-1.8-4.6" />
    </Icon>
  );
}

export function IconAncestor(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="5" cy="12" r="2.2" />
      <circle cx="19" cy="6.5" r="2.2" />
      <circle cx="19" cy="17.5" r="2.2" />
      <path d="M7.2 12h4.3v-5.5h5.3M11.5 12v5.5h5.3" />
    </Icon>
  );
}

export function IconDescendant(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="19" cy="12" r="2.2" />
      <circle cx="5" cy="6.5" r="2.2" />
      <circle cx="5" cy="17.5" r="2.2" />
      <path d="M16.8 12h-4.3v-5.5H7.2M12.5 12v5.5H7.2" />
    </Icon>
  );
}

export function IconHourglass(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="2.2" />
      <path d="M9.8 12H4.5M14.2 12h5.3M6 7h3M6 17h3M15 7h3M15 17h3" />
      <path d="M4.5 7v10M19.5 7v10" />
    </Icon>
  );
}

export function IconRelationship(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="7" r="2" />
      <circle cx="18" cy="7" r="2" />
      <circle cx="12" cy="17.5" r="2" />
      <path d="M8 7h8M7.5 8.8l3 6.9M16.5 8.8l-3 6.9" />
    </Icon>
  );
}

export function IconFan(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 20a8 8 0 0 1 0-16 8 8 0 0 1 0 16z" />
      <path d="M12 12 5 8M12 12l7-4M12 12v8" />
      <circle cx="12" cy="12" r="1.8" />
    </Icon>
  );
}
