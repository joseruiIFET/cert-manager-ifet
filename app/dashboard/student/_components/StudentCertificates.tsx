'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CertificateCard } from '@/components/CertificateCard/CertificateCard';
import { EmptyState } from '@/components/Feedback/Feedback';
import { FilterBar } from '@/components/FilterBar/FilterBar';
import { IconEdit, IconPlus } from '@/components/Icones/Icones';
import { ProgressBar } from '@/components/ProgressBar/ProgressBar';
import { useToast } from '@/components/Toast/Toast';
import {
  calculateStudentProgress,
  filterCertificates,
  findRuleForCertificate,
} from '@/lib/domain/hoursCalculation';
import type {
  ActivityType,
  Axis,
  Certificate,
  CertificateFilterState,
  CertificateStatus,
} from '@/lib/types';
import { CertificateFormModal } from './CertificateFormModal';
import styles from './StudentCertificates.module.css';

interface Props {
  studentId: string;
  certificates: Certificate[];
  activityTypes: ActivityType[];
  totalRequiredHours?: number;
}

export function StudentCertificates({
  studentId,
  certificates,
  activityTypes,
  totalRequiredHours,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [isRefreshing, startTransition] = useTransition();

  const [modal, setModal] = useState<{ editing: Certificate | null } | null>(null);

  // Estado consolidado de filtros simultâneos
  const [filters, setFilters] = useState<CertificateFilterState>({
    axis: 'all',
    activityTypeId: 'all',
    status: 'all',
    query: '',
  });

  // Cálculo de progresso completo do estudante com segmentação por eixos
  const progress = useMemo(
    () => calculateStudentProgress(certificates, activityTypes, totalRequiredHours),
    [certificates, activityTypes, totalRequiredHours]
  );

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

  const hoursFormatter = useMemo(() => new Intl.NumberFormat('pt-BR'), []);

  const statusCounts = useMemo<Record<CertificateStatus | 'all', number>>(
    () => ({
      all: certificates.length,
      pending: pendingCertificates.length,
      approved: approvedCertificates.length,
      rejected: rejectedCertificates.length,
    }),
    [certificates.length, pendingCertificates.length, approvedCertificates.length, rejectedCertificates.length]
  );

  // Lista de certificados resultante da aplicação de todos os filtros combinados
  const visibleCertificates = useMemo(
    () => filterCertificates(certificates, activityTypes, filters),
    [certificates, activityTypes, filters]
  );

  function handleSaved(message: string) {
    setModal(null);
    toast.success(message);
    startTransition(() => router.refresh());
  }

  function handleAxisSelect(axis: Axis) {
    setFilters((prev) => ({
      ...prev,
      axis: prev.axis === axis ? 'all' : axis,
      activityTypeId: 'all',
    }));
  }

  function handleResetFilters() {
    setFilters({
      axis: 'all',
      activityTypeId: 'all',
      status: 'all',
      query: '',
    });
  }

  return (
    <div>
      {/* Faixa de indicadores do estudante */}
      <div className={styles.indicators}>
        <div className={styles.indicator}>
          <div className={styles.indicatorValue}>{approvedCertificates.length}</div>
          <div className={styles.indicatorLabel}>
            Aprovados · {hoursFormatter.format(progress.totalApprovedHours)} h reconhecidas
          </div>
        </div>
        <div className={styles.indicator}>
          <div className={styles.indicatorValue}>{pendingCertificates.length}</div>
          <div className={styles.indicatorLabel}>
            Em análise {progress.totalPendingHours > 0 && `· ${progress.totalPendingHours} h reservadas`}
          </div>
        </div>
        <div className={styles.indicator}>
          <div className={styles.indicatorValue}>{rejectedCertificates.length}</div>
          <div className={styles.indicatorLabel}>Rejeitados</div>
        </div>
      </div>

      {/* Seção de Progresso com Barra Segmentada */}
      <section className={styles.summary} aria-label="Progresso de horas complementares">
        <div className={styles.progressContainer}>
          <ProgressBar
            approvedHours={progress.totalApprovedHours}
            totalHours={progress.totalRequiredHours}
            progress={progress}
            selectedAxis={filters.axis}
            onSelectAxis={handleAxisSelect}
          />
        </div>

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

      {/* Barra de Filtros Combinados (Eixo, Atividade, Situação, Busca) */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        rules={activityTypes}
        totalCount={certificates.length}
        filteredCount={visibleCertificates.length}
        statusCounts={statusCounts}
        onReset={handleResetFilters}
      />

      {/* Lista de Certificados */}
      <div role="region" aria-label="Lista de certificados" aria-busy={isRefreshing}>
        {certificates.length === 0 ? (
          <EmptyState
            title="Você ainda não enviou certificados"
            hint="Envie seus certificados de cursos, palestras e eventos para acumular suas horas complementares."
            action={
              <button
                type="button"
                className="btn-primary"
                onClick={() => setModal({ editing: null })}
                disabled={isRefreshing}
              >
                <IconPlus size={16} /> Novo certificado
              </button>
            }
          />
        ) : visibleCertificates.length === 0 ? (
          <EmptyState
            title="Nenhum certificado encontrado"
            hint="Nenhum registro corresponde aos filtros ou à pesquisa selecionada."
            action={
              <button
                type="button"
                className="btn-secondary"
                onClick={handleResetFilters}
              >
                Limpar filtros
              </button>
            }
          />
        ) : (
          visibleCertificates.map((cert) => {
            const rule = findRuleForCertificate(cert, activityTypes);
            return (
              <CertificateCard
                key={cert.id}
                cert={cert}
                rule={rule}
                actions={
                  cert.status === 'rejected' ? (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setModal({ editing: cert })}
                    >
                      <IconEdit size={16} /> Corrigir
                    </button>
                  ) : cert.status === 'approved' ? (
                    <span className={styles.locked}>Aprovado — somente leitura</span>
                  ) : null
                }
              />
            );
          })
        )}
      </div>

      {modal && (
        <CertificateFormModal
          studentId={studentId}
          editing={modal.editing}
          activityTypes={activityTypes}
          certificates={certificates}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
