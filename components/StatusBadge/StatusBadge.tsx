import { IconCheck, IconClock, IconX } from '@/components/Icones/Icones';
import type { CertificateStatus } from '@/lib/types';
import styles from './StatusBadge.module.css';

const MAP: Record<CertificateStatus, { label: string; className: string; Icon: typeof IconCheck }> = {
  pending: { label: 'Em análise', className: styles.pending, Icon: IconClock },
  approved: { label: 'Aprovado', className: styles.approved, Icon: IconCheck },
  rejected: { label: 'Rejeitado', className: styles.rejected, Icon: IconX },
};

/** Vocabulário visual único do status (design.md §3): ícone + texto + cor. */
export function StatusBadge({ status }: { status: CertificateStatus }) {
  const { label, className, Icon } = MAP[status];
  return (
    <span className={`${styles.badge} ${className}`}>
      <Icon size={14} />
      {label}
    </span>
  );
}
