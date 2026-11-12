'use client';

import { useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { CertificateCard } from '@/components/CertificateCard/CertificateCard';
import { EmptyState, Skeleton } from '@/components/Feedback/Feedback';
import { FilterBar } from '@/components/FilterBar/FilterBar';
import { IconArrowLeft, IconCheck, IconX } from '@/components/Icones/Icones';
import { ProgressBar } from '@/components/ProgressBar/ProgressBar';
import { useToast } from '@/components/Toast/Toast';
import {
  calculateHoursForCertificate,
  calculateStudentProgress,
  filterCertificates,
  findRuleForCertificate,
} from '@/lib/domain/hoursCalculation';
import { mensagemDeErro } from '@/lib/errors';
import { useServices } from '@/lib/services/useServices';
import type {
  ActivityType,
  Axis,
  Certificate,
  CertificateFilterState,
  CertificateStatus,
  StudentSummary,
} from '@/lib/types';
import styles from './ReviewWorkspace.module.css';

interface Props {
  summaries: StudentSummary[];
  rules: ActivityType[];
  initialId: string | null;
  initialCertificates: Certificate[];
}

type Decision = { cert: Certificate; kind: 'approve' | 'reject' };
type DateOrder = 'desc' | 'asc';
type StudentFilter = 'all' | 'pending';

/**
 * Fila da coordenação (design.md §8.3): master–detail com lista de alunos à esquerda e
 * certificados do aluno selecionado à direita. Oferece busca por nome/email/matrícula,
 * filtros combinados por eixo, tipo de atividade, situação e busca textual, com ordenação por data.
 */
export function ReviewWorkspace({
  summaries: initialSummaries,
  rules,
  initialId,
  initialCertificates,
}: Props) {
  const { certificates: certificatesService } = useServices();
  const toast = useToast();

  const [summaries, setSummaries] = useState(initialSummaries);
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  // Cache por aluno: voltar a um aluno já visto não refaz o round-trip (performance.md §2).
  const [cache, setCache] = useState<Record<string, Certificate[]>>(
    initialId ? { [initialId]: initialCertificates } : {}
  );
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);

  // Filtros de estudantes
  const [query, setQuery] = useState('');
  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all');
  const [dateOrder, setDateOrder] = useState<DateOrder>('desc');
  const [detailOpen, setDetailOpen] = useState(initialId !== null);

  // Filtros combinados de certificados do aluno selecionado
  const [certFilters, setCertFilters] = useState<CertificateFilterState>({
    axis: 'all',
    activityTypeId: 'all',
    status: 'all',
    query: '',
  });

  const selected = summaries.find((s) => s.profile.id === selectedId) ?? null;
  const items = selectedId ? cache[selectedId] : undefined;
  const certList = useMemo(() => items ?? [], [items]);

  // Indicadores agregados do topo
  const totalPending = useMemo(
    () => summaries.reduce((sum, s) => sum + s.pendingCount, 0),
    [summaries]
  );
  const studentsWithPending = useMemo(
    () => summaries.filter((s) => s.pendingCount > 0).length,
    [summaries]
  );
  const totalApprovedHours = useMemo(
    () => summaries.reduce((sum, s) => sum + s.approvedHours, 0),
    [summaries]
  );
  const hoursFormatter = useMemo(() => new Intl.NumberFormat('pt-BR'), []);

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

  // Progresso segmentado do aluno selecionado
  const studentProgress = useMemo(
    () => calculateStudentProgress(certList, rules),
    [certList, rules]
  );

  // Contagem de certificados por status para o aluno selecionado
  const certCounts = useMemo<Record<CertificateStatus | 'all', number>>(() => {
    return {
      all: certList.length,
      pending: certList.filter((c) => c.status === 'pending').length,
      approved: certList.filter((c) => c.status === 'approved').length,
      rejected: certList.filter((c) => c.status === 'rejected').length,
    };
  }, [certList]);

  // Certificados filtrados por eixo, tipo, situação, texto e ordenados por data
  const filteredCertificates = useMemo(() => {
    const list = filterCertificates(certList, rules, certFilters);
    return [...list].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return dateOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [certList, rules, certFilters, dateOrder]);

  async function selectStudent(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
    setCertFilters({ axis: 'all', activityTypeId: 'all', status: 'all', query: '' });

    if (cache[id]) return;
    setLoadingId(id);
    try {
      const list = await certificatesService.listByStudent(id);
      setCache((prev) => ({ ...prev, [id]: list }));
    } catch (err) {
      toast.error(
        mensagemDeErro(err, 'Não foi possível carregar os certificados deste aluno. Por favor, tente novamente.')
      );
    } finally {
      setLoadingId(null);
    }
  }

  function handleAxisSelect(axis: Axis) {
    setCertFilters((prev) => ({
      ...prev,
      axis: prev.axis === axis ? 'all' : axis,
      activityTypeId: 'all',
    }));
  }

  function handleResetCertFilters() {
    setCertFilters({
      axis: 'all',
      activityTypeId: 'all',
      status: 'all',
      query: '',
    });
  }

  /** Reflete a decisão na lista e no resumo (contagem de pendências e horas aprovadas), reordenando por pendências desc. */
  function applyDecision(updated: Certificate, approvedHoursDiff: number) {
    const studentId = updated.studentId;
    setCache((prev) => {
      const list = prev[studentId] ?? [];
      return { ...prev, [studentId]: list.map((c) => (c.id === updated.id ? updated : c)) };
    });
    setSummaries((prev) =>
      prev
        .map((s) =>
          s.profile.id !== studentId
            ? s
            : {
                ...s,
                pendingCount: Math.max(s.pendingCount - 1, 0),
                approvedHours: s.approvedHours + approvedHoursDiff,
              }
        )
        .sort((a, b) => b.pendingCount - a.pendingCount)
    );
  }

  async function confirmDecision(reason: string) {
    if (!decision) return;
    const { cert, kind } = decision;

    try {
      if (kind === 'approve') {
        const rule = findRuleForCertificate(cert, rules);
        const calculation = rule
          ? calculateHoursForCertificate({
              declaredHours: cert.hours,
              rule,
              studentCertificates: certList,
              currentCertId: cert.id,
            })
          : null;

        const recognizedToPersist = calculation?.recognizedHours ?? cert.recognizedHours ?? cert.hours;

        await certificatesService.approve(cert.id, recognizedToPersist);
        const updated: Certificate = {
          ...cert,
          status: 'approved',
          recognizedHours: recognizedToPersist,
        };

        applyDecision(updated, recognizedToPersist);

        const hoursText =
          recognizedToPersist === 1
            ? '1 hora foi computada'
            : `${recognizedToPersist} horas foram computadas`;
        toast.success(`Certificado aprovado com sucesso! ${hoursText} no progresso do aluno.`);
      } else {
        const feedback = await certificatesService.reject(cert, reason);
        const updated: Certificate = {
          ...cert,
          status: 'rejected',
          feedback,
        };
        applyDecision(updated, 0);
        toast.success('Certificado rejeitado com sucesso. A justificativa foi salva para orientação do aluno.');
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

  // Dados calculados para exibição no diálogo de aprovação
  const approvalCalc = useMemo(() => {
    if (!decision || decision.kind !== 'approve') return null;
    const cert = decision.cert;
    const rule = findRuleForCertificate(cert, rules);
    if (!rule) {
      return { recognized: cert.hours, declared: cert.hours, excess: 0 };
    }
    const calc = calculateHoursForCertificate({
      declaredHours: cert.hours,
      rule,
      studentCertificates: certList,
      currentCertId: cert.id,
    });
    return {
      recognized: calc.recognizedHours,
      declared: calc.declaredHours,
      excess: calc.excessHours,
    };
  }, [decision, rules, certList]);

  if (summaries.length === 0) {
    return <EmptyState title="Nenhum certificado enviado ainda" hint="Quando os alunos enviarem, eles aparecerão aqui." />;
  }

  return (
    <>
      {/* Faixa de indicadores da coordenação */}
      <div className={styles.indicators}>
        <div className={styles.indicator}>
          <div className={styles.indicatorValue}>{totalPending}</div>
          <div className={styles.indicatorLabel}>Pendências totais</div>
        </div>
        <div className={styles.indicator}>
          <div className={styles.indicatorValue}>{studentsWithPending}</div>
          <div className={styles.indicatorLabel}>Alunos com pendências</div>
        </div>
        <div className={styles.indicator}>
          <div className={styles.indicatorValue}>{hoursFormatter.format(totalApprovedHours)} h</div>
          <div className={styles.indicatorLabel}>Horas aprovadas</div>
        </div>
      </div>

      <div className={`${styles.workspace} ${detailOpen ? styles.showDetail : ''}`}>
        {/* Painel Esquerdo: Lista de Alunos */}
        <aside className={styles.list} aria-label="Alunos">
          <div className={styles.listHeader}>
            <h2>
              Alunos ({filteredSummaries.length !== summaries.length ? `${filteredSummaries.length} de ${summaries.length}` : summaries.length})
            </h2>
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
                Com pendências ({studentsWithPending})
              </button>
            </div>
          </div>

          <ul role="list">
            {filteredSummaries.map((s) => {
              const isSelected = s.profile.id === selectedId;
              const initial = (s.profile.fullName || s.profile.email).charAt(0).toUpperCase();

              return (
                <li key={s.profile.id}>
                  <button
                    type="button"
                    className={`${styles.student} ${isSelected ? styles.studentActive : ''}`}
                    onClick={() => selectStudent(s.profile.id)}
                    aria-current={isSelected ? 'true' : undefined}
                  >
                    <span className={styles.avatar} aria-hidden="true">{initial}</span>
                    <span className={styles.studentInfo}>
                      <strong>{s.profile.fullName || 'Estudante'}</strong>
                      <span className={styles.studentSub}>
                        {s.profile.matricula && (
                          <span className={styles.matriculaTag}>Matr.: {s.profile.matricula}</span>
                        )}
                        {s.pendingCount > 0 ? (
                          <span className={styles.pendingText}>
                            {s.pendingCount} {s.pendingCount === 1 ? 'pendência' : 'pendências'}
                          </span>
                        ) : (
                          <span className={styles.okText}>Sem pendências</span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {filteredSummaries.length === 0 && (
              <li className={styles.noMatch} role="status" aria-live="polite">
                Nenhum aluno encontrado para os critérios pesquisados.
              </li>
            )}
          </ul>
        </aside>

        {/* Painel Direito: Detalhe do Aluno Selecionado */}
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

                <div className={styles.headerProgress}>
                  <ProgressBar
                    approvedHours={studentProgress.totalApprovedHours}
                    totalHours={studentProgress.totalRequiredHours}
                    progress={studentProgress}
                    selectedAxis={certFilters.axis}
                    onSelectAxis={handleAxisSelect}
                    label="Progresso do aluno"
                  />
                </div>
              </header>

              {loadingId === selectedId || !items ? (
                <Skeleton rows={3} />
              ) : (
                <>
                  {/* Filtros Combinados de Certificados (Eixo, Atividade, Situação, Busca) */}
                  <FilterBar
                    filters={certFilters}
                    onChange={setCertFilters}
                    rules={rules}
                    totalCount={certList.length}
                    filteredCount={filteredCertificates.length}
                    statusCounts={certCounts}
                    onReset={handleResetCertFilters}
                    placeholder="Buscar certificados deste aluno…"
                  />

                  {/* Ordenação por data de envio */}
                  <div className={styles.sortRow}>
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
                      title="Nenhum certificado encontrado"
                      hint="Nenhum certificado deste estudante corresponde aos filtros ativos."
                      action={
                        <button type="button" className="btn-secondary" onClick={handleResetCertFilters}>
                          Limpar filtros
                        </button>
                      }
                    />
                  ) : (
                    <div className={styles.certList}>
                      {filteredCertificates.map((cert) => {
                        const rule = findRuleForCertificate(cert, rules);
                        return (
                          <CertificateCard
                            key={cert.id}
                            cert={cert}
                            rule={rule}
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
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>

        {/* Diálogos de Confirmação de Decisão */}
        {decision?.kind === 'approve' && approvalCalc && (
          <ConfirmDialog
            title="Aprovar certificado"
            message={
              approvalCalc.excess > 0 ? (
                <>
                  Aprovar <b>{decision.cert.title}</b>?
                  <br />
                  <br />
                  O estudante declarou <strong>{approvalCalc.declared} h</strong>, mas serão reconhecidas{' '}
                  <strong>{approvalCalc.recognized} h</strong> no seu progresso.{' '}
                  <em>({approvalCalc.excess} h excedentes desconsideradas conforme as regras do PPC).</em>
                </>
              ) : (
                <>
                  Aprovar <b>{decision.cert.title}</b> ({approvalCalc.recognized} h)?
                  <br />
                  As horas serão creditadas no progresso do estudante.
                </>
              )
            }
            confirmLabel="Confirmar aprovação"
            onConfirm={confirmDecision}
            onCancel={() => setDecision(null)}
          />
        )}

        {decision?.kind === 'reject' && (
          <ConfirmDialog
            title="Rejeitar certificado"
            message={
              <>
                Rejeitar <b>{decision.cert.title}</b>? O estudante será notificado com o motivo informado e
                poderá corrigir e reenviar o comprovante.
              </>
            }
            confirmLabel="Confirmar rejeição"
            tone="danger"
            reasonLabel="Motivo da rejeição (obrigatório)"
            onConfirm={confirmDecision}
            onCancel={() => setDecision(null)}
          />
        )}
      </div>
    </>
  );
}
