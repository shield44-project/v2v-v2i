import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type PageShellProps = {
  pageClassName: string;
  cardClassName: string;
  maxWidth?: number;
  showNav?: boolean;
  children: ReactNode;
};

type PanelHeaderProps = {
  title: string;
  subtitle: string;
  actions?: ReactNode;
};

type ChipRowProps = {
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
};

type TableCardProps = {
  children: ReactNode;
};

function joinClassNames(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const shellLinks = [
  { href: "/", label: "Home" },
  { href: "/control", label: "Control" },
  { href: "/admin", label: "Admin" },
  { href: "/user-portal", label: "Roles" },
  { href: "/emergency", label: "Emergency" },
  { href: "/signal", label: "Signal" },
  { href: "/archive", label: "Archive" }
];

export function PageShell({ pageClassName, cardClassName, maxWidth = 980, showNav = true, children }: PageShellProps) {
  const pathname = usePathname();

  return (
    <main className={joinClassNames("page", pageClassName)}>
      <div className={joinClassNames("card", cardClassName)} style={{ maxWidth }}>
        {showNav ? (
          <nav className="shell-nav" aria-label="Primary module navigation">
            {shellLinks.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className="shell-nav-link" data-active={isActive}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
        {children}
      </div>
    </main>
  );
}

export function PanelHeader({ title, subtitle, actions }: PanelHeaderProps) {
  return (
    <div className="legacy-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions ? <div className="legacy-actions">{actions}</div> : null}
    </div>
  );
}

export function ChipRow({ className, children, style }: ChipRowProps) {
  return <div className={joinClassNames("routes", className)} style={style}>{children}</div>;
}

export function StatusMessage({ children }: { children: ReactNode }) {
  return <p className="status-line">{children}</p>;
}

export function TableCard({ children }: TableCardProps) {
  return <div className="table-wrap">{children}</div>;
}
