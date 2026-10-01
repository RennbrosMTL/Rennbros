/** The opening of every inner page: label, title, lead. */
export function PageHead({ label, title, lead, children }: { label?: string; title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <header className="ph page">
      {label && <p className="label label--red">{label}</p>}
      <h1 className="d2 ph__title" id="page-title">{title}</h1>
      {lead && <p className="lead ph__lead">{lead}</p>}
      {children}
    </header>
  );
}
