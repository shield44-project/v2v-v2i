import type { CSSProperties, ReactNode } from "react";

type PageShellProps = {
  pageClassName: string;
  cardClassName: string;
  maxWidth?: number;
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

export function PageShell({ pageClassName, cardClassName, maxWidth = 980, children }: PageShellProps) {
  return (
    <main className={joinClassNames("page", pageClassName)}>
      <div className={joinClassNames("card", cardClassName)} style={{ maxWidth }}>
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
