'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './coordinator.module.css';
import Link from 'next/link';

export default function CoordinatorDashboard() {
  const [loading, setLoading] = useState(true);
  const [groupedStudents, setGroupedStudents] = useState({});
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [rules, setRules] = useState([]);
  const [studentStats, setStudentStats] = useState({ approved: 0, total: 120 });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedStudentId) {
      calculateProgress(selectedStudentId);
    }
  }, [groupedStudents, selectedStudentId]);

  const calculateProgress = (studentId) => {
    const studentData = groupedStudents[studentId];
    if (!studentData) return;

    const totalApproved = studentData.items
      .filter(i => i.status === 'approved')
      .reduce((acc, curr) => acc + curr.hours, 0);

    setStudentStats({ approved: totalApproved, total: 120 });
  };

  async function fetchData() {
    try {
      setLoading(true);

      const certsReq = supabase
        .from('certificates')
        .select('*, profiles (id, full_name, email)')
        .order('created_at', { ascending: true });

      const rulesReq = supabase.from('activity_types').select('*');

      const [certsRes, rulesRes] = await Promise.all([certsReq, rulesReq]);

      if (certsRes.error) throw certsRes.error;

      const agrupado = certsRes.data.reduce((acc, curr) => {
        const studentId = curr.profiles.id;
        if (!acc[studentId]) {
          acc[studentId] = { profile: curr.profiles, items: [] };
        }
        acc[studentId].items.push(curr);
        return acc;
      }, {});

      setGroupedStudents(agrupado);
      setRules(rulesRes.data || []);

      if (!selectedStudentId && Object.keys(agrupado).length > 0) {
        const idComPendencia = Object.keys(agrupado).find(id =>
          agrupado[id].items.some(i => i.status === 'pending')
        );
        setSelectedStudentId(idComPendencia || Object.keys(agrupado)[0]);
      }

    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleDecision = async (cert, newStatus) => {
    let newFeedback = cert.feedback;

    if (newStatus === 'rejected') {
      const motivo = prompt("Motivo da rejeição:");
      if (!motivo) return;

      const dataHoje = new Date().toLocaleDateString();
      const msgAtual = `[${dataHoje}] ${motivo}`;
      newFeedback = cert.feedback ? `${msgAtual}\n----------------\n${cert.feedback}` : msgAtual;
    }

    try {
      const payload = { status: newStatus, feedback: newFeedback };

      const { error } = await supabase
        .from('certificates')
        .update(payload)
        .eq('id', cert.id);

      if (error) throw error;

      const novoAgrupamento = { ...groupedStudents };
      const aluno = novoAgrupamento[selectedStudentId];

      const index = aluno.items.findIndex(i => i.id === cert.id);
      if (index !== -1) {
        aluno.items[index] = { ...aluno.items[index], ...payload };
      }

      setGroupedStudents(novoAgrupamento);
      alert(`Certificado ${newStatus === 'approved' ? 'Aprovado' : 'Rejeitado'}!`);

    } catch (error) {
      alert('Erro: ' + error.message);
    }
  };

  const getRule = (categoryName) => rules.find(r => r.description === categoryName);

  const studentsList = Object.values(groupedStudents).sort((a, b) => {
    const aPending = a.items.filter(i => i.status === 'pending').length;
    const bPending = b.items.filter(i => i.status === 'pending').length;
    return bPending - aPending;
  });

  const activeStudentData = groupedStudents[selectedStudentId];
  const progressPercent = Math.min((studentStats.approved / studentStats.total) * 100, 100);

  const pendencias = activeStudentData?.items.filter(i => i.status === 'pending') || [];
  const historico = activeStudentData?.items.filter(i => i.status !== 'pending') || [];

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <Link
                href="/dashboard/coordinator/activities"
                style={{
                  marginLeft: 'auto',
                  marginTop:'15px',
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  color: '#374151',
                  fontSize: '0.9rem',
                  fontWeight: '600'
                }}
              >
                ⚙️ Configurar Atividades
              </Link>
        <div className={styles.sidebarHeader}>

          <h2>Alunos</h2>
          
        </div>
        <div className={styles.studentList}>
          {studentsList.map((group) => {
            const pendingCount = group.items.filter(i => i.status === 'pending').length;
            return (
              <div
                key={group.profile.id}
                className={`${styles.studentItem} ${selectedStudentId === group.profile.id ? styles.active : ''}`}
                onClick={() => setSelectedStudentId(group.profile.id)}
              >
                <div className={styles.avatarSmall}>{group.profile.full_name?.charAt(0)}</div>
                <div className={styles.studentItemInfo}>
                  <strong>{group.profile.full_name}</strong>
                  {pendingCount > 0 ? (
                    <span style={{ color: '#d97706', fontWeight: 'bold' }}>{pendingCount} pendente(s)</span>
                  ) : (
                    <span style={{ color: '#16a34a' }}>Tudo em dia</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <main className={styles.mainContent}>
        {!activeStudentData ? (
          <div className={styles.welcomeState}><p>Selecione um aluno.</p></div>
        ) : (
          <>
            <header className={styles.mainHeader}>

              
              <div className={styles.headerTop}>
                <div className={styles.headerProfile}>
                  <div className={styles.avatarLarge}>{activeStudentData.profile.full_name?.charAt(0)}</div>
                  <div>
                    <h1>{activeStudentData.profile.full_name}</h1>
                    <p>{activeStudentData.profile.email}</p>
                  </div>
                </div>
                <div className={styles.progressContainer}>
                  <div className={styles.progressInfo}>
                    <span>Progresso Aprovado</span>
                    <strong>{studentStats.approved} / {studentStats.total}h</strong>
                  </div>
                  <div className={styles.progressBarBg}>
                    <div className={styles.progressBarFill} style={{ width: `${progressPercent}%` }}></div>
                  </div>
                </div>
              </div>
            </header>

            <div className={styles.certificatesScroll}>

              {/* PENDÊNCIAS */}
              {pendencias.length > 0 && (
                <div className={styles.sectionBlock}>
                  <h3 className={styles.sectionTitle}>⚠️ Pendências (Requer Atenção)</h3>
                  {pendencias.map((cert) => (
                    <CertCard
                      key={cert.id}
                      cert={cert}
                      rule={getRule(cert.category)}
                      onApprove={() => handleDecision(cert, 'approved')}
                      onReject={() => handleDecision(cert, 'rejected')}
                    />
                  ))}
                </div>
              )}

              {/* HISTÓRICO */}
              <div className={styles.sectionBlock}>
                <h3 className={styles.sectionTitle}>📜 Histórico Completo</h3>
                {historico.length === 0 ? <p style={{ color: '#999' }}>Nenhum histórico.</p> : (
                  historico.map((cert) => (
                    <CertCard
                      key={cert.id}
                      cert={cert}
                      rule={getRule(cert.category)}
                      isHistory={true}
                    />
                  ))
                )}
              </div>

            </div>
          </>
        )}
      </main>
    </div>
  );
}

// --- COMPONENTE DO CARTÃO (AGORA COM A COLA DE VOLTA) ---
function CertCard({ cert, rule, onApprove, onReject, isHistory }) {
  const isLowHours = rule && cert.hours < rule.min_hours;

  return (
    <div className={`${styles.certCard} ${isHistory ? styles.historyCard : ''}`}>
      <div className={styles.certHeader}>
        <span className={styles.certTag}>{cert.category}</span>
        <span className={styles.certDate}>{new Date(cert.created_at).toLocaleDateString()}</span>
        {isHistory && (
          <span className={`${styles.statusBadge} ${cert.status === 'approved' ? styles.badgeGreen : styles.badgeRed}`}>
            {cert.status === 'approved' ? 'APROVADO' : 'REJEITADO'}
          </span>
        )}
      </div>

      <div className={styles.certBody}>
        {/* Lado Esquerdo: Info Principal */}
        <div className={styles.certMainInfo}>
          <h3>{cert.title}</h3>
          <div className={styles.hoursRow}>
            <strong>{cert.hours} horas</strong>
            {isLowHours && !isHistory && <span className={styles.warningTag}>⚠️ Abaixo do Mínimo: {rule?.min_hours}h</span>}
          </div>
          {cert.file_url ? (
            <a href={cert.file_url} target="_blank" className={styles.fileLink}>📄 Ver Arquivo</a>
          ) : <span>Sem arquivo</span>}

          {cert.feedback && (
            <div className={styles.feedbackDisplay}>
              <strong>Histórico de Correções:</strong>
              <pre>{cert.feedback}</pre>
            </div>
          )}
        </div>

        {/* --- AQUI ESTÁ A COLA DE VOLTA! --- */}
        {rule && (
          <div className={styles.auditBox}>
            <strong>📋 Regra Oficial:</strong>
            <ul>
              <li>Mínimo: <strong>{rule.min_hours}h</strong></li>
              <li>Teto: <strong>{rule.max_hours}h</strong></li>
              <li>Exige: <br /><em>{rule.proof_type}</em></li>
            </ul>
          </div>
        )}
        {/* ---------------------------------- */}

        {/* Ações (Só aparecem se não for histórico) */}
        {!isHistory && (
          <div className={styles.certActions}>
            <button className={styles.btnReject} onClick={onReject}>Rejeitar</button>
            <button className={styles.btnApprove} onClick={() => {
              if (confirm("Aprovar?")) onApprove();
            }}>Aprovar</button>
          </div>
        )}
      </div>
    </div>
  );
}