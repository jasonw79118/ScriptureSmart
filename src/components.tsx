import type { ReactNode } from 'react';
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">▤</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Heading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">SCRIPTURESMART WORKSPACE</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
