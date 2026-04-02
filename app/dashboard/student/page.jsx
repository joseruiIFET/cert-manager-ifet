'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './student.module.css';

export default function StudentDashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  const [certificados, setCertificados] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  
  // Estado para controlar se é EDIÇÃO ou CRIAÇÃO
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    activityTypeId: '',
    title: '',
    hours: '',
    file: null,
    existingFileUrl: null // Para manter o arquivo antigo se o aluno não trocar
  });

  const [selectedRule, setSelectedRule] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const certsReq = supabase.from('certificates').select('*').order('created_at', { ascending: false });
      const typesReq = supabase.from('activity_types').select('*').eq('is_active', true);

      const [certsRes, typesRes] = await Promise.all([certsReq, typesReq]);

      if (certsRes.error) throw certsRes.error;

      setCertificados(certsRes.data || []);
      setActivityTypes(typesRes.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  // ABRIR MODAL PARA EDIÇÃO
  const handleEdit = (cert) => {
    // Achar o ID da regra baseado no nome (category)
    const rule = activityTypes.find(t => t.description === cert.category);
    
    setEditingId(cert.id); // Define que estamos editando
    setFormData({
      activityTypeId: rule ? rule.id : '',
      title: cert.title,
      hours: cert.hours,
      file: null, // Começa nulo, se ele não mexer, usa o existingFileUrl
      existingFileUrl: cert.file_url
    });
    setSelectedRule(rule);
    setIsModalOpen(true);
  };

  // ABRIR MODAL PARA NOVO
  const handleNew = () => {
    setEditingId(null); // Define que é novo
    setFormData({ activityTypeId: '', title: '', hours: '', file: null, existingFileUrl: null });
    setSelectedRule(null);
    setIsModalOpen(true);
  };

  const handleTypeChange = (e) => {
    const typeId = e.target.value;
    const rule = activityTypes.find(t => t.id === typeId);
    setSelectedRule(rule);
    setFormData({ ...formData, activityTypeId: typeId });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!formData.title) return alert("Preencha o Título.");
    if (!formData.activityTypeId) return alert("Selecione o Tipo.");
    if (!formData.hours) return alert("Preencha as Horas.");
    // Se for novo, exige arquivo. Se for edição, exige arquivo SÓ SE não tiver url antiga.
    if (!editingId && !formData.file) return alert("Selecione um arquivo.");

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Logue novamente.');

      let finalFileUrl = formData.existingFileUrl;

      // 1. Se tem arquivo novo, faz upload
      if (formData.file) {
        const fileExt = formData.file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents') 
          .upload(fileName, formData.file);

        if (uploadError) throw new Error(`Erro Storage: ${uploadError.message}`);

        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);
          
        finalFileUrl = publicUrl;
      }

      // 2. Insert ou Update
      const payload = {
        student_id: user.id,
        title: formData.title,
        category: selectedRule.description,
        hours: parseInt(formData.hours),
        file_url: finalFileUrl,
        status: 'pending' // IMPORTANTE: Volta para pendente ao editar
      };

      let dbError;

      if (editingId) {
        // UPDATE
        const { error } = await supabase
          .from('certificates')
          .update(payload)
          .eq('id', editingId);
        dbError = error;
      } else {
        // INSERT
        const { error } = await supabase.from('certificates').insert([payload]);
        dbError = error;
      }

      if (dbError) throw new Error(dbError.message);

      alert(`Certificado ${editingId ? 'corrigido' : 'enviado'} com sucesso!`);
      setIsModalOpen(false);
      fetchInitialData(); 

    } catch (error) {
      alert(`Erro: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const totalHoras = certificados.filter(c => c.status === 'approved').reduce((acc, curr) => acc + curr.hours, 0);
  const progresso = Math.min((totalHoras / 120) * 100, 100);

  return (
    <div className={styles.container}>
      {/* HEADER (Igual) */}
      <header className={styles.header}>
        <div><h1 className={styles.title}>Meus Certificados</h1><p className={styles.subtitle}>Gerencie suas horas</p></div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Horas Aprovadas</span>
          <div className={styles.progressBarBg}><div className={styles.progressBarFill} style={{ width: `${progresso}%` }}></div></div>
          <span className={styles.summaryValue}>{totalHoras} / 120 horas</span>
        </div>
      </header>

      <div className={styles.actions}>
        <button className={styles.btnPrimary} onClick={handleNew}>+ Novo Certificado</button>
      </div>

      <section className={styles.listContainer}>
        {loading ? <p>Carregando...</p> : certificados.map((cert) => (
            <div key={cert.id} className={styles.card}>
              <div className={styles.cardIcon}>📄</div>
              <div className={styles.cardContent}>
                <h3 className={styles.cardTitle}>{cert.title}</h3>
                <span className={styles.cardCategory}>{cert.category}</span>
                
                {/* MOSTRAR FEEDBACK SE REJEITADO */}
                {cert.status === 'rejected' && cert.feedback && (
                  <div style={{marginTop: '10px', background: '#fff0f0', padding: '10px', borderRadius: '5px', fontSize: '0.8rem', color: '#991b1b'}}>
                    <strong>Atenção (Rejeitado):</strong>
                    <pre style={{whiteSpace: 'pre-wrap', marginTop: '5px'}}>{cert.feedback}</pre>
                  </div>
                )}
                
                {cert.file_url && <a href={cert.file_url} target="_blank" className={styles.linkDoc}>Ver arquivo</a>}
              </div>
              
              <div className={styles.cardInfo}>
                <span className={styles.hoursBadge}>{cert.hours}h</span>
                
                {/* BOTÃO CORRIGIR SE REJEITADO */}
                {cert.status === 'rejected' ? (
                  <button 
                    onClick={() => handleEdit(cert)}
                    style={{marginTop:'5px', background:'#2563eb', color:'white', border:'none', padding:'5px 10px', borderRadius:'4px', cursor:'pointer', fontSize:'0.8rem'}}
                  >
                    ✏️ Corrigir
                  </button>
                ) : (
                  <span className={`${styles.statusBadge} ${styles[cert.status]}`}>{cert.status}</span>
                )}
              </div>
            </div>
          ))}
      </section>

      {/* MODAL REAPROVEITADO */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <div className={styles.modalHeader}>
              <h2>{editingId ? 'Corrigir Certificado' : 'Enviar Novo Certificado'}</h2>
              <button className={styles.btnClose} onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            
            <div className={styles.form}>
              {/* Select e Inputs iguais ao anterior, ligados ao state formData */}
              <div className={styles.formGroup}>
                <label>Tipo de Atividade</label>
                <select value={formData.activityTypeId} onChange={handleTypeChange}>
                  <option value="">-- Selecione --</option>
                  {activityTypes.map(t => <option key={t.id} value={t.id}>{t.description}</option>)}
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label>Título</label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>

              <div className={styles.formGroup}>
                <label>Horas</label>
                <input type="number" value={formData.hours} onChange={e => setFormData({...formData, hours: e.target.value})} />
              </div>

              <div className={styles.formGroup}>
                <label>Arquivo {editingId && '(Deixe vazio para manter o atual)'}</label>
                <input type="file" onChange={e => setFormData({...formData, file: e.target.files[0]})} />
                {formData.existingFileUrl && !formData.file && (
                  <small style={{color: '#2563eb'}}>Arquivo atual mantido.</small>
                )}
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.btnCancel} onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="button" className={styles.btnSubmit} onClick={handleSubmit} disabled={uploading}>
                  {uploading ? 'Salvando...' : (editingId ? 'Salvar Correção' : 'Enviar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}