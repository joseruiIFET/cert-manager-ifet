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

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className={styles.empty}>
      <strong>{title}</strong>
      {hint && <p>{hint}</p>}
    </div>
  );
}
