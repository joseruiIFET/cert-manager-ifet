'use client';

import { useMemo, useState, useTransition } from 'react';
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
const FILTER_KEYS: Filter[] = ['all', 'pending', 'approved', 'rejected'];

interface Props {
  studentId: string;
  certificates: Certificate[];
  activityTypes: ActivityType[];
}

export function StudentCertificates({ studentId, certificates, activityTypes }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isRefreshing, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>('all');
  const [modal, setModal] = useState<{ editing: Certificate | null } | null>(null);

  const approvedCertificates = useMemo(
    () => certificates.filter((c) => c.status === 'approved'),
    [certificates]
  );
  const pendingCertificates = useMemo(
    () => certificates.filter((c) => c.status === 'pending'),
    [certificates]
  );
  const rejectedCertificates = useMemo(
    () => certificates.filter((c) => c.status === 'rejected'),
    [certificates]
  );

  const approvedHours = useMemo(
    () => approvedCertificates.reduce((sum, c) => sum + c.hours, 0),
    [approvedCertificates]
  );

  const hoursFormatter = useMemo(() => new Intl.NumberFormat('pt-BR'), []);

  const filterCounts = useMemo<Record<Filter, number>>(
    () => ({
      all: certificates.length,
      pending: pendingCertificates.length,
      approved: approvedCertificates.length,
      rejected: rejectedCertificates.length,
    }),
    [certificates.length, pendingCertificates.length, approvedCertificates.length, rejectedCertificates.length]
  );

  const visible = useMemo(
    () => (filter === 'all' ? certificates : certificates.filter((c) => c.status === filter)),
    [certificates, filter]
  );

  function handleSaved(message: string) {
    setModal(null);
    toast.success(message);
    startTransition(() => router.refresh());
  }

  function handleTablistKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const currentIndex = FILTER_KEYS.indexOf(filter);
    const nextIndex =
      e.key === 'ArrowRight'
        ? (currentIndex + 1) % FILTER_KEYS.length
        : (currentIndex - 1 + FILTER_KEYS.length) % FILTER_KEYS.length;
    const nextKey = FILTER_KEYS[nextIndex];
    setFilter(nextKey);
    const nextTab = document.getElementById(`tab-${nextKey}`);
    nextTab?.focus();
  }

  return (
    <div>
      {/* Faixa de indicadores do estudante */}
      <div className={styles.indicators}>
        <div className={styles.indicator}>
          <div className={styles.indicatorValue}>{approvedCertificates.length}</div>
          <div className={styles.indicatorLabel}>
            Aprovados · {hoursFormatter.format(approvedHours)} h aprovadas
          </div>
        </div>
        <div className={styles.indicator}>
          <div className={styles.indicatorValue}>{pendingCertificates.length}</div>
          <div className={styles.indicatorLabel}>Em análise</div>
        </div>
        <div className={styles.indicator}>
          <div className={styles.indicatorValue}>{rejectedCertificates.length}</div>
          <div className={styles.indicatorLabel}>Rejeitados</div>
        </div>
      </div>

      <section className={styles.summary} aria-label="Progresso">
        <ProgressBar approvedHours={approvedHours} />
        <button
          type="button"
          className="btn-primary"
          onClick={() => setModal({ editing: null })}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <>
              <span className="spinner" /> Atualizando…
            </>
          ) : (
            <>
              <IconPlus size={16} /> Novo certificado
            </>
          )}
        </button>
      </section>

      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Filtrar por status"
        aria-busy={isRefreshing}
        onKeyDown={handleTablistKeyDown}
      >
        {FILTERS.map((f) => (
          <button
            key={f.key}
            id={`tab-${f.key}`}
            type="button"
            role="tab"
            tabIndex={filter === f.key ? 0 : -1}
            aria-selected={filter === f.key}
            aria-controls={`panel-${f.key}`}
            className={`${styles.tab} ${filter === f.key ? styles.tabActive : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label} ({filterCounts[f.key]})
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${filter}`}
        aria-labelledby={`tab-${filter}`}
      >
        {visible.length === 0 ? (
          <EmptyState
            title={certificates.length === 0 ? 'Você ainda não enviou certificados' : 'Nenhum certificado neste filtro'}
            hint={certificates.length === 0 ? 'Use “Novo certificado” para começar.' : undefined}
            action={
              certificates.length === 0 ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setModal({ editing: null })}
                  disabled={isRefreshing}
                >
                  <IconPlus size={16} /> Novo certificado
                </button>
              ) : undefined
            }
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
      </div>

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
