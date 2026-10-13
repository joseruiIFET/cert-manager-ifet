'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CertificateCard } from '@/components/CertificateCard/CertificateCard';
import { EmptyState } from '@/components/Feedback/Feedback';
import { IconEdit, IconPlus } from '@/components/Icones/Icones';
import { ProgressBar } from '@/components/ProgressBar/ProgressBar';
import { useToast } from '@/components/Toast/Toast';
import type { ActivityType, Certificate, CertificateStatus } from '@/lib/types';
import { CertificateFormModal } from './CertificateFormModal';
import styles from './StudentCertificates.module.css';

type Filter = 'all' | CertificateStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Em análise' },
  { key: 'approved', label: 'Aprovados' },
  { key: 'rejected', label: 'Rejeitados' },
];

interface Props {
  studentId: string;
  certificates: Certificate[];
  activityTypes: ActivityType[];
}

export function StudentCertificates({ studentId, certificates, activityTypes }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>('all');
  const [modal, setModal] = useState<{ editing: Certificate | null } | null>(null);

  const approvedHours = certificates
    .filter((c) => c.status === 'approved')
    .reduce((sum, c) => sum + c.hours, 0);
  const visible = filter === 'all' ? certificates : certificates.filter((c) => c.status === filter);

  function handleSaved(message: string) {
    setModal(null);
    toast.success(message);
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <section className={styles.summary} aria-label="Progresso">
        <ProgressBar approvedHours={approvedHours} />
        <button type="button" className="btn-primary" onClick={() => setModal({ editing: null })}>
          <IconPlus size={16} /> Novo certificado
        </button>
      </section>

      <div className={styles.tabs} role="tablist" aria-label="Filtrar por status">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={`${styles.tab} ${filter === f.key ? styles.tabActive : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={certificates.length === 0 ? 'Você ainda não enviou certificados' : 'Nenhum certificado neste filtro'}
          hint={certificates.length === 0 ? 'Use “Novo certificado” para começar.' : undefined}
        />
      ) : (
        visible.map((cert) => (
          <CertificateCard
            key={cert.id}
            cert={cert}
            actions={
              cert.status === 'rejected' ? (
                <button type="button" className="btn-primary" onClick={() => setModal({ editing: cert })}>
                  <IconEdit size={16} /> Corrigir
                </button>
              ) : cert.status === 'approved' ? (
                <span className={styles.locked}>Aprovado — não pode ser alterado</span>
              ) : null
            }
          />
        ))
      )}

      {modal && (
        <CertificateFormModal
          studentId={studentId}
          editing={modal.editing}
          activityTypes={activityTypes}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
