import { IconClock, IconInfo, IconWarning } from '@/components/Icones/Icones';
import { FileLink } from '@/components/FileLink/FileLink';
import { StatusBadge } from '@/components/StatusBadge/StatusBadge';
import { formatDate } from '@/lib/datas';
import type { ActivityType, Certificate } from '@/lib/types';
import styles from './CertificateCard.module.css';

interface CertificateCardProps {
  cert: Certificate;
  /** Regra oficial da categoria (coordenação ou inferida). Quando presente, mostra o quadro de regra e os alertas. */
  rule?: ActivityType;
  /** Ações (aprovar/rejeitar/corrigir) — o recorte por papel é feito por quem usa o cartão. */
  actions?: React.ReactNode;
}

const AXIS_CLASS_MAP: Record<string, string> = {
  Tecnológico: styles.axisTecnologico,
  Integrador: styles.axisIntegrador,
  Básico: styles.axisBasico,
};

/** Cartão único de certificado, usado por aluno e coordenação (design.md §6). */
export function CertificateCard({ cert, rule, actions }: CertificateCardProps) {
  const belowMin = rule ? cert.hours < rule.minHours : false;
  const aboveMax = rule ? cert.hours > rule.maxHours : false;

  const hasDistinctRecognized =
    typeof cert.recognizedHours === 'number' && cert.recognizedHours !== cert.hours;

  const recognized = typeof cert.recognizedHours === 'number' ? cert.recognizedHours : cert.hours;
  const excess = Math.max(0, cert.hours - recognized);

  const axis = rule?.axis;
  const axisClass = axis ? AXIS_CLASS_MAP[axis] : undefined;

  return (
    <article className={styles.card}>
      <div className={styles.main}>
        <div className={styles.meta}>
          {axis && (
            <span className={`${styles.axisTag} ${axisClass ?? ''}`} title={`Eixo ${axis}`}>
              {axis}
            </span>
          )}
          <span className={styles.tag}>{cert.category}</span>
          <span className={styles.date}>{formatDate(cert.createdAt)}</span>
          <StatusBadge status={cert.status} />
        </div>

        <h3 className={styles.title}>{cert.title}</h3>

        <div className={styles.hoursRow}>
          {/* Badge de Horas */}
          <div className={styles.hoursBadge}>
            <IconClock size={15} />
            <span className={styles.hoursText}>
              {cert.status === 'approved' ? (
                <>
                  <strong>{recognized}</strong> {recognized === 1 ? 'hora aprovada' : 'horas aprovadas'}
                  {hasDistinctRecognized && (
                    <span className={styles.declaredNote}>({cert.hours} h declaradas)</span>
                  )}
                </>
              ) : hasDistinctRecognized ? (
                <>
                  <strong>{recognized} h</strong> propostas{' '}
                  <span className={styles.declaredNote}>({cert.hours} h declaradas · {excess} h excedentes)</span>
                </>
              ) : (
                <>
                  <strong>{cert.hours}</strong> {cert.hours === 1 ? 'hora' : 'horas'}
                </>
              )}
            </span>
          </div>

          {/* Aviso informativo de horas abaixo do mínimo (não impeditivo) */}
          {cert.status === 'pending' && belowMin && (
            <span className={styles.infoNotice} role="status" title="Envio permitido; a coordenação avaliará segundo as regras do PPC">
              <IconInfo size={14} /> Abaixo do mínimo de {rule?.minHours} h
            </span>
          )}

          {/* Aviso de horas acima do teto individual */}
          {cert.status === 'pending' && aboveMax && (
            <span className={styles.warnNotice} role="status">
              <IconWarning size={14} /> Teto de {rule?.maxHours} h por certificado (excedente desconsiderado)
            </span>
          )}
        </div>

        <FileLink fileRef={cert.fileRef} className={styles.fileLink} />

        {cert.feedback && cert.status !== 'approved' && (
          <div className={styles.feedback}>
            <strong>{cert.status === 'rejected' ? 'Motivo da rejeição' : 'Histórico de correções'}</strong>
            <pre>{cert.feedback}</pre>
          </div>
        )}
      </div>

      {rule && (
        <aside className={styles.rule} aria-label="Regra oficial">
          <strong>Regra oficial ({rule.axis})</strong>
          <ul>
            <li>Mínimo por cert.: <b>{rule.minHours} h</b></li>
            <li>Teto por cert.: <b>{rule.maxHours} h</b></li>
            {typeof rule.maxAccumulatedHours === 'number' && rule.maxAccumulatedHours > 0 && (
              <li>Teto acumulado: <b>{rule.maxAccumulatedHours} h</b></li>
            )}
            <li>Exige: <em>{rule.proofType}</em></li>
          </ul>
        </aside>
      )}

      {actions && <div className={styles.actions}>{actions}</div>}
    </article>
  );
}
