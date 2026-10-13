import { IconWarning } from '@/components/Icones/Icones';
import { FileLink } from '@/components/FileLink/FileLink';
import { StatusBadge } from '@/components/StatusBadge/StatusBadge';
import { formatDate } from '@/lib/datas';
import type { ActivityType, Certificate } from '@/lib/types';
import styles from './CertificateCard.module.css';

interface CertificateCardProps {
  cert: Certificate;
  /** Regra oficial da categoria (coordenação). Quando presente, mostra o quadro de regra e os alertas. */
  rule?: ActivityType;
  /** Ações (aprovar/rejeitar/corrigir) — o recorte por papel é feito por quem usa o cartão. */
  actions?: React.ReactNode;
}

/** Cartão único de certificado, usado por aluno e coordenação (design.md §6). */
export function CertificateCard({ cert, rule, actions }: CertificateCardProps) {
  const belowMin = rule ? cert.hours < rule.minHours : false;
  const aboveMax = rule ? cert.hours > rule.maxHours : false;

  return (
    <article className={styles.card}>
      <div className={styles.main}>
        <div className={styles.meta}>
          <span className={styles.tag}>{cert.category}</span>
          <span className={styles.date}>{formatDate(cert.createdAt)}</span>
          <StatusBadge status={cert.status} />
        </div>
        <h3 className={styles.title}>{cert.title}</h3>
        <div className={styles.hoursRow}>
          <strong>{cert.hours} horas</strong>
          {cert.status === 'pending' && belowMin && (
            <span className={styles.warn}><IconWarning size={14} /> Abaixo do mínimo: {rule?.minHours} h</span>
          )}
          {cert.status === 'pending' && aboveMax && (
            <span className={styles.warn}><IconWarning size={14} /> Acima do teto: {rule?.maxHours} h</span>
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
          <strong>Regra oficial</strong>
          <ul>
            <li>Mínimo: <b>{rule.minHours} h</b></li>
            <li>Teto: <b>{rule.maxHours} h</b></li>
            <li>Exige: <em>{rule.proofType}</em></li>
          </ul>
        </aside>
      )}

      {actions && <div className={styles.actions}>{actions}</div>}
    </article>
  );
}
