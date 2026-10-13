'use client';

import { useMemo, useState } from 'react';
import { CertificateCard } from '@/components/CertificateCard/CertificateCard';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { EmptyState, Skeleton } from '@/components/Feedback/Feedback';
import { IconArrowLeft, IconCheck, IconX } from '@/components/Icones/Icones';
import { ProgressBar } from '@/components/ProgressBar/ProgressBar';
import { useToast } from '@/components/Toast/Toast';
import { mensagemDeErro } from '@/lib/errors';
import { useServices } from '@/lib/services/useServices';
import type { ActivityType, Certificate, StudentSummary } from '@/lib/types';
import styles from './ReviewWorkspace.module.css';

interface Props {
  summaries: StudentSummary[];
  rules: ActivityType[];
  initialId: string | null;
  initialCertificates: Certificate[];
}

type Decision = { cert: Certificate; kind: 'approve' | 'reject' };

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
  const [detailOpen, setDetailOpen] = useState(initialId !== null);

  const selected = summaries.find((s) => s.profile.id === selectedId) ?? null;
  const items = selectedId ? cache[selectedId] : undefined;

  const filteredSummaries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? summaries.filter((s) => `${s.profile.fullName} ${s.profile.email}`.toLowerCase().includes(q))
      : summaries;
  }, [summaries, query]);

  const ruleOf = (category: string) => rules.find((r) => r.description === category);

  async function selectStudent(id: string) {
    setSelectedId(id);
    setDetailOpen(true);
    if (cache[id]) return;
    setLoadingId(id);
    try {
      const list = await certificates.listByStudent(id);
      setCache((prev) => ({ ...prev, [id]: list }));
    } catch (err) {
      toast.error(mensagemDeErro(err));
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
        toast.success('Certificado aprovado.');
      } else {
        const feedback = await certificates.reject(cert, reason);
        applyDecision({ ...cert, status: 'rejected', feedback });
        toast.success('Certificado rejeitado. O aluno verá o motivo.');
      }
      setDecision(null);
    } catch (err) {
      toast.error(mensagemDeErro(err));
    }
  }

  const pending = items?.filter((c) => c.status === 'pending') ?? [];
  const history = items?.filter((c) => c.status !== 'pending') ?? [];

  if (summaries.length === 0) {
    return <EmptyState title="Nenhum certificado enviado ainda" hint="Quando os alunos enviarem, eles aparecerão aqui." />;
  }

  return (
    <div className={`${styles.workspace} ${detailOpen ? styles.showDetail : ''}`}>
      <aside className={styles.list} aria-label="Alunos">
        <div className={styles.listHeader}>
          <h2>Alunos</h2>
          <input
            className="form-input"
            type="search"
            placeholder="Buscar por nome ou e-mail"
            aria-label="Buscar aluno"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
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
                  <span className={styles.avatar} aria-hidden="true">{s.profile.fullName.charAt(0)}</span>
                  <span className={styles.studentInfo}>
                    <strong>{s.profile.fullName || s.profile.email}</strong>
                    <span className={s.pendingCount > 0 ? styles.pendingText : styles.okText}>
                      {s.pendingCount > 0 ? `${s.pendingCount} pendente(s)` : 'Tudo em dia'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {filteredSummaries.length === 0 && <li className={styles.noMatch}>Nenhum aluno encontrado.</li>}
        </ul>
      </aside>

      <section className={styles.detail} aria-label="Detalhe do aluno">
        {!selected ? (
          <EmptyState title="Selecione um aluno" />
        ) : (
          <>
            <button type="button" className={styles.back} onClick={() => setDetailOpen(false)}>
              <IconArrowLeft size={16} /> Voltar para alunos
            </button>
            <header className={styles.header}>
              <div className={styles.headerProfile}>
                <span className={styles.avatarLarge} aria-hidden="true">{selected.profile.fullName.charAt(0)}</span>
                <div>
                  <h2>{selected.profile.fullName}</h2>
                  <p>{selected.profile.email}</p>
                </div>
              </div>
              <ProgressBar approvedHours={selected.approvedHours} label="Progresso aprovado" />
            </header>

            {loadingId === selectedId || !items ? (
              <Skeleton rows={3} />
            ) : (
              <>
                {pending.length > 0 && (
                  <div className={styles.section}>
                    <h3>Pendências — requer atenção</h3>
                    {pending.map((cert) => (
                      <CertificateCard
                        key={cert.id}
                        cert={cert}
                        rule={ruleOf(cert.category)}
                        actions={
                          <>
                            <button type="button" className="btn-secondary" onClick={() => setDecision({ cert, kind: 'reject' })}>
                              <IconX size={16} /> Rejeitar
                            </button>
                            <button type="button" className="btn-primary" onClick={() => setDecision({ cert, kind: 'approve' })}>
                              <IconCheck size={16} /> Aprovar
                            </button>
                          </>
                        }
                      />
                    ))}
                  </div>
                )}
                <div className={styles.section}>
                  <h3>Histórico</h3>
                  {history.length === 0 ? (
                    <EmptyState title="Nenhum certificado decidido ainda" />
                  ) : (
                    history.map((cert) => <CertificateCard key={cert.id} cert={cert} rule={ruleOf(cert.category)} />)
                  )}
                </div>
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
