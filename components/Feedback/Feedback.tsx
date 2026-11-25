import styles from './Feedback.module.css';

/** Carregamento na geometria do conteúdo (design.md §6) — sem tela em branco nem layout shift. */
export function Skeleton({ rows = 3, height = 88 }: { rows?: number; height?: number }) {
  return (
    <div aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.skeleton} style={{ height }} />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <strong>{title}</strong>
      {hint && <p>{hint}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
