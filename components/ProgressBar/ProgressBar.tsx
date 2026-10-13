import { TOTAL_REQUIRED_HOURS } from '@/lib/types';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  approvedHours: number;
  totalHours?: number;
  label?: string;
}

/** Conta única "horas aprovadas / carga total" (arch.md §5) — só aqui se calcula a porcentagem. */
export function ProgressBar({
  approvedHours,
  totalHours = TOTAL_REQUIRED_HOURS,
  label = 'Horas aprovadas',
}: ProgressBarProps) {
  const percent = Math.min(Math.round((approvedHours / totalHours) * 100), 100);
  return (
    <div className={styles.wrapper}>
      <div className={styles.info}>
        <span>{label}</span>
        <strong>{approvedHours} / {totalHours} h</strong>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={totalHours}
        aria-valuenow={Math.min(approvedHours, totalHours)}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
