'use client';

import { useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { CertificateCard } from '@/components/CertificateCard/CertificateCard';
import { EmptyState, Skeleton } from '@/components/Feedback/Feedback';
import { IconArrowLeft, IconCheck, IconX } from '@/components/Icones/Icones';
import { ProgressBar } from '@/components/ProgressBar/ProgressBar';
import { useToast } from '@/components/Toast/Toast';
import { mensagemDeErro } from '@/lib/errors';
import { useServices } from '@/lib/services/useServices';
import type { ActivityType, Certificate, CertificateStatus, StudentSummary } from '@/lib/types';
import styles from './ReviewWorkspace.module.css';

interface Props {
  summaries: StudentSummary[];
  rules: ActivityType[];
  initialId: string | null;
  initialCertificates: Certificate[];
}

type Decision = { cert: Certificate; kind: 'approve' | 'reject' };
type CertificateFilter = 'all' | CertificateStatus;
type DateOrder = 'desc' | 'asc';
type StudentFilter = 'all' | 'pending';

const CERT_FILTERS: { key: CertificateFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'approved', label: 'Aprovados' },
  { key: 'rejected', label: 'Rejeitados' },
];

/**
 * Fila da coordenação (design.md §8.3): master–detail com lista de alunos à esquerda e
 * certificados do aluno selecionado à direita. Oferece busca por nome/email/matrícula,
 * filtros por status de certificado e ordenação por data de envio.
 */
export function ReviewWorkspace({ summaries: initialSummaries, rules, initialId, initialCertificates }: Props) {
  const { certificates } = useServices();
  const toast = useToast();

  const [summaries, setSummaries] = useState(initialSummaries);
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  // Cache por aluno: voltar a um aluno já visto não refaz o round-trip (performance.md §2).
  const [cache, setCache] = useState<Record<string, Certificate[]>>(
    initialId ? { [initialId]: initialCertificates } : {}
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [query, setQuery] = useState('');
  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<CertificateFilter>('all');
  const [dateOrder, setDateOrder] = useState<DateOrder>('desc');
  const [detailOpen, setDetailOpen] = useState(initialId !== null);

  const selected = summaries.find((s) => s.profile.id === selectedId) ?? null;
  const items = selectedId ? cache[selectedId] : undefined;

  // Filtro de alunos por busca (nome, e-mail ou matrícula) e pendências
  const filteredSummaries = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = summaries;
    if (studentFilter === 'pending') {
      list = list.filter((s) => s.pendingCount > 0);
    }
    if (!q) return list;
    return list.filter((s) => {
      const name = (s.profile.fullName || '').toLowerCase();
      const email = (s.profile.email || '').toLowerCase();
      const matricula = (s.profile.matricula || '').toLowerCase();
      return name.includes(q) || email.includes(q) || matricula.includes(q);
    });
  }, [summaries, query, studentFilter]);

  const ruleOf = (category: string) => rules.find((r) => r.description === category);

  // Contagem de certificados do aluno selecionado
  const certList = useMemo(() => items ?? [], [items]);
  const certCounts = useMemo(() => {
    return {
      all: certList.length,
      pending: certList.filter((c) => c.status === 'pending').length,
      approved: certList.filter((c) => c.status === 'approved').length,
      rejected: certList.filter((c) => c.status === 'rejected').length,
    };
  }, [certList]);

  // Certificados filtrados por status e ordenados por data de envio
  const filteredCertificates = useMemo(() => {
    let list = certList;
    if (statusFilter !== 'all') {
      list = list.filter((c) => c.status === statusFilter);
    }
    return [...list].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return dateOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [certList, statusFilter, dateOrder]);

  async function selectStudent(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
    if (cache[id]) return;
    setLoadingId(id);
    try {
      const list = await certificates.listByStudent(id);
      setCache((prev) => ({ ...prev, [id]: list }));
    } catch (err) {
      toast.error(mensagemDeErro(err, 'Não foi possível carregar os certificados deste aluno. Por favor, tente novamente.'));
    } finally {
      setLoadingId(null);
    }
  }

  /** Reflete a decisão na lista e no resumo (contagem de pendências e horas aprovadas). */
  function applyDecision(updated: Certificate) {
    const studentId = updated.studentId;
    setCache((prev) => {
      const list = prev[studentId] ?? [];
      return { ...prev, [studentId]: list.map((c) => (c.id === updated.id ? updated : c)) };
    });
    setSummaries((prev) =>
      prev.map((s) =>
        s.profile.id !== studentId
          ? s
          : {
              ...s,
              pendingCount: Math.max(s.pendingCount - 1, 0),
              approvedHours: s.approvedHours + (updated.status === 'approved' ? updated.hours : 0),
            }
      )
    );
  }

  async function confirmDecision(reason: string) {
    if (!decision) return;
    const { cert, kind } = decision;
    try {
      if (kind === 'approve') {
        await certificates.approve(cert.id);
        applyDecision({ ...cert, status: 'approved' });
        const hoursText = cert.hours === 1 ? '1 hora foi computada' : `${cert.hours} horas foram computadas`;
        toast.success(`Certificado aprovado com sucesso! ${hoursText} no progresso do aluno.`);
      } else {
        const feedback = await certificates.reject(cert, reason);
        applyDecision({ ...cert, status: 'rejected', feedback });
        toast.success('Certificado rejeitado com sucesso. A justificativa foi salva e o aluno foi orientado para correção.');
      }
      setDecision(null);
    } catch (err) {
      toast.error(
        mensagemDeErro(
          err,
          kind === 'approve'
            ? 'Não foi possível aprovar o certificado. Por favor, tente novamente.'
            : 'Não foi possível registrar a rejeição do certificado. Por favor, tente novamente.'
        )
      );
    }
  }

  if (summaries.length === 0) {
    return <EmptyState title="Nenhum certificado enviado ainda" hint="Quando os alunos enviarem, eles aparecerão aqui." />;
  }

  const pendingStudentsCount = summaries.filter((s) => s.pendingCount > 0).length;

  return (
    <div className={`${styles.workspace} ${detailOpen ? styles.showDetail : ''}`}>
      <aside className={styles.list} aria-label="Alunos">
        <div className={styles.listHeader}>
          <h2>Alunos ({summaries.length})</h2>
          <input
            className="form-input"
            type="search"
            placeholder="Buscar por nome, e-mail ou matrícula"
            aria-label="Buscar aluno por nome, e-mail ou matrícula"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className={styles.studentFilterTabs} role="tablist" aria-label="Filtrar lista de alunos">
            <button
              type="button"
              role="tab"
              aria-selected={studentFilter === 'all'}
              className={`${styles.studentTab} ${studentFilter === 'all' ? styles.studentTabActive : ''}`}
              onClick={() => setStudentFilter('all')}
            >
              Todos ({summaries.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={studentFilter === 'pending'}
              className={`${styles.studentTab} ${studentFilter === 'pending' ? styles.studentTabActive : ''}`}
              onClick={() => setStudentFilter('pending')}
            >
              Com pendências ({pendingStudentsCount})
            </button>
          </div>
        </div>
        <ul>
          {filteredSummaries.map((s) => {
            const active = s.profile.id === selectedId;
            return (
              <li key={s.profile.id}>
                <button
                  type="button"
                  className={`${styles.student} ${active ? styles.studentActive : ''}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => selectStudent(s.profile.id)}
                >
                  <span className={styles.avatar} aria-hidden="true">
                    {(s.profile.fullName || s.profile.email).charAt(0).toUpperCase()}
                  </span>
                  <span className={styles.studentInfo}>
                    <strong>{s.profile.fullName || s.profile.email}</strong>
                    <div className={styles.studentSub}>
                      {s.profile.matricula && (
                        <span className={styles.matriculaTag}>Matrícula: {s.profile.matricula}</span>
                      )}
                      <span className={s.pendingCount > 0 ? styles.pendingText : styles.okText}>
                        {s.pendingCount > 0 ? `${s.pendingCount} pendente(s)` : 'Tudo em dia'}
                      </span>
                    </div>
                  </span>
                </button>
              </li>
            );
          })}
          {filteredSummaries.length === 0 && (
            <li className={styles.noMatch}>
              Nenhum aluno encontrado para os critérios pesquisados.
            </li>
          )}
        </ul>
      </aside>

      <section className={styles.detail} aria-label="Detalhe do aluno">
        {!selected ? (
          <EmptyState title="Selecione um aluno" hint="Escolha um estudante na lista à esquerda para analisar seus certificados." />
        ) : (
          <>
            <button type="button" className={styles.back} onClick={() => setDetailOpen(false)}>
              <IconArrowLeft size={16} /> Voltar para lista de alunos
            </button>
            <header className={styles.header}>
              <div className={styles.headerProfile}>
                <span className={styles.avatarLarge} aria-hidden="true">
                  {(selected.profile.fullName || selected.profile.email).charAt(0).toUpperCase()}
                </span>
                <div>
                  <h2>{selected.profile.fullName || 'Estudante'}</h2>
                  <p>{selected.profile.email}</p>
                  {selected.profile.matricula && (
                    <p className={styles.headerMatricula}>
                      Matrícula: <strong>{selected.profile.matricula}</strong>
                    </p>
                  )}
                </div>
              </div>
              <ProgressBar approvedHours={selected.approvedHours} label="Progresso aprovado" />
            </header>

            {loadingId === selectedId || !items ? (
              <Skeleton rows={3} />
            ) : (
              <>
                <div className={styles.filterBar}>
                  <div className={styles.tabs} role="tablist" aria-label="Filtrar certificados por status">
                    {CERT_FILTERS.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        role="tab"
                        aria-selected={statusFilter === f.key}
                        className={`${styles.tab} ${statusFilter === f.key ? styles.tabActive : ''}`}
                        onClick={() => setStatusFilter(f.key)}
                      >
                        <span>{f.label}</span>
                        <span className={styles.tabBadge}>{certCounts[f.key]}</span>
                      </button>
                    ))}
                  </div>

                  <div className={styles.sortGroup}>
                    <label htmlFor="sort-order" className={styles.sortLabel}>
                      Ordenar por envio:
                    </label>
                    <select
                      id="sort-order"
                      className={`form-select ${styles.sortSelect}`}
                      value={dateOrder}
                      onChange={(e) => setDateOrder(e.target.value as DateOrder)}
                      aria-label="Ordenar certificados por data de envio"
                    >
                      <option value="desc">Mais recentes primeiro</option>
                      <option value="asc">Mais antigos primeiro</option>
                    </select>
                  </div>
                </div>

                {filteredCertificates.length === 0 ? (
                  <EmptyState
                    title={
                      statusFilter === 'pending'
                        ? 'Nenhum certificado pendente'
                        : statusFilter === 'approved'
                        ? 'Nenhum certificado aprovado'
                        : statusFilter === 'rejected'
                        ? 'Nenhum certificado rejeitado'
                        : 'Nenhum certificado encontrado'
                    }
                    hint={
                      statusFilter === 'all'
                        ? 'O estudante ainda não enviou nenhum certificado.'
                        : 'Não há certificados neste status para este aluno.'
                    }
                  />
                ) : (
                  <div className={styles.certList}>
                    {filteredCertificates.map((cert) => (
                      <CertificateCard
                        key={cert.id}
                        cert={cert}
                        rule={ruleOf(cert.category)}
                        actions={
                          cert.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setDecision({ cert, kind: 'reject' })}
                              >
                                <IconX size={16} /> Rejeitar
                              </button>
                              <button
                                type="button"
                                className="btn-primary"
                                onClick={() => setDecision({ cert, kind: 'approve' })}
                              >
                                <IconCheck size={16} /> Aprovar
                              </button>
                            </>
                          ) : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </section>

      {decision?.kind === 'approve' && (
        <ConfirmDialog
          title="Aprovar certificado"
          message={<>Aprovar <b>{decision.cert.title}</b> ({decision.cert.hours} h)? As horas passam a contar no progresso do aluno.</>}
          confirmLabel="Aprovar"
          onConfirm={confirmDecision}
          onCancel={() => setDecision(null)}
        />
      )}
      {decision?.kind === 'reject' && (
        <ConfirmDialog
          title="Rejeitar certificado"
          message={<>Rejeitar <b>{decision.cert.title}</b>? O aluno poderá corrigir e reenviar.</>}
          confirmLabel="Rejeitar"
          tone="danger"
          reasonLabel="Motivo da rejeição"
          onConfirm={confirmDecision}
          onCancel={() => setDecision(null)}
        />
      )}
    </div>
  );
}
