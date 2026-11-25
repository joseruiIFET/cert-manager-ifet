import { AXES, TOTAL_REQUIRED_HOURS, type Axis, type StudentProgress } from '@/lib/types';
import styles from './ProgressBar.module.css';

export interface ProgressBarProps {
  approvedHours: number;
  totalHours?: number;
  label?: string;
  progress?: StudentProgress;
  pendingHours?: number;
  selectedAxis?: Axis | 'all';
  onSelectAxis?: (axis: Axis) => void;
}

const AXIS_COLOR_VARS: Record<Axis, string> = {
  Tecnológico: 'var(--axis-tecnologico)',
  Integrador: 'var(--axis-integrador)',
  Básico: 'var(--axis-basico)',
};

const AXIS_BG_VARS: Record<Axis, string> = {
  Tecnológico: 'var(--axis-tecnologico-bg)',
  Integrador: 'var(--axis-integrador-bg)',
  Básico: 'var(--axis-basico-bg)',
};

/**
 * Barra de progresso segmentada por categoria/eixo de atividade.
 * Apresenta a carga cumprida em cada eixo em relação à carga horária total exigida,
 * exibe horas restantes e horas reservadas em análise separadamente,
 * e permite filtrar ao clicar nos eixos ou legenda.
 */
export function ProgressBar({
  approvedHours,
  totalHours = TOTAL_REQUIRED_HOURS,
  label = 'Progresso de horas',
  progress,
  pendingHours = 0,
  selectedAxis = 'all',
  onSelectAxis,
}: ProgressBarProps) {
  const safeTotal = progress ? progress.totalRequiredHours : totalHours;
  const safeApproved = progress ? progress.totalApprovedHours : approvedHours;
  const safePending = progress ? progress.totalPendingHours : pendingHours;
  const safePercent = progress
    ? progress.percent
    : Math.min(100, Math.round((safeApproved / safeTotal) * 100));
  const remaining = progress ? progress.remainingHours : Math.max(0, safeTotal - safeApproved);

  return (
    <div className={styles.wrapper}>
      {/* Cabeçalho do progresso */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.label}>{label}</span>
          <span className={styles.percentBadge}>{safePercent}% concluído</span>
        </div>
        <div className={styles.hoursValues}>
          <strong className={styles.approvedHighlight}>{safeApproved}</strong>
          <span className={styles.totalRequired}>/ {safeTotal} h exigidas</span>
        </div>
      </div>

      {/* Barra segmentada */}
      <div
        className={styles.track}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={Math.min(safeApproved, safeTotal)}
        aria-valuetext={`${safeApproved} de ${safeTotal} horas aprovadas (${safePercent}%)`}
      >
        {progress ? (
          AXES.map((axis) => {
            const data = progress.axes[axis];
            if (!data || data.approvedHours <= 0) return null;
            const segmentWidth = Math.min(100, (data.approvedHours / safeTotal) * 100);
            const isSelected = selectedAxis === axis;

            return (
              <button
                key={axis}
                type="button"
                className={`${styles.segment} ${isSelected ? styles.segmentSelected : ''}`}
                style={{
                  width: `${segmentWidth}%`,
                  backgroundColor: AXIS_COLOR_VARS[axis],
                }}
                title={`${axis}: ${data.approvedHours} h aprovadas (${Math.round(segmentWidth)}% do total)`}
                aria-label={`${axis}: ${data.approvedHours} horas`}
                onClick={() => onSelectAxis?.(axis)}
                tabIndex={onSelectAxis ? 0 : -1}
              />
            );
          })
        ) : (
          <div
            className={styles.fillSimple}
            style={{ width: `${safePercent}%` }}
          />
        )}
      </div>

      {/* Legenda com categorias e horas reconhecidas */}
      {progress && (
        <div className={styles.legend} role="group" aria-label="Legenda das categorias">
          {AXES.map((axis) => {
            const data = progress.axes[axis];
            const hours = data?.approvedHours ?? 0;
            const isSelected = selectedAxis === axis;

            return (
              <button
                key={axis}
                type="button"
                className={`${styles.legendItem} ${isSelected ? styles.legendItemSelected : ''}`}
                onClick={() => onSelectAxis?.(axis)}
                aria-pressed={isSelected}
                title={onSelectAxis ? `Filtrar certificados pelo eixo ${axis}` : undefined}
                style={{
                  borderColor: isSelected ? AXIS_COLOR_VARS[axis] : undefined,
                  backgroundColor: isSelected ? AXIS_BG_VARS[axis] : undefined,
                }}
              >
                <span
                  className={styles.legendDot}
                  style={{ backgroundColor: AXIS_COLOR_VARS[axis] }}
                  aria-hidden="true"
                />
                <span className={styles.legendAxisName}>{axis}:</span>
                <strong className={styles.legendHours}>{hours} h</strong>
              </button>
            );
          })}
        </div>
      )}

      {/* Rodapé com horas restantes e horas reservadas */}
      <div className={styles.footer}>
        <div className={styles.remainingText}>
          {remaining > 0 ? (
            <>Faltam <strong>{remaining} h</strong> para atingir o total exigido.</>
          ) : (
            <span className={styles.goalAchieved}>Meta de horas cumprida! 🎉</span>
          )}
        </div>

        {safePending > 0 && (
          <div className={styles.pendingBadge} title="Horas reservadas por certificados em análise (não contabilizadas como concluídas)">
            <span className={styles.pendingDot} aria-hidden="true" />
            <span><strong>{safePending} h</strong> em análise (reserva provisória)</span>
          </div>
        )}
      </div>
    </div>
  );
}
