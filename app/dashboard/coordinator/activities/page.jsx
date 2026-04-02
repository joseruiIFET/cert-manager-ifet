'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './activities.module.css';
import Link from 'next/link';

export default function ActivitiesManager() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [activities, setActivities] = useState([]);
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    eixo: 'Integrador',
    description: '',
    min_hours: 20,
    max_hours: 40,
    proof_type: '',
    is_active: true
  });

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      fetchActivities(selectedCourseId);
    }
  }, [selectedCourseId]);

  async function fetchCourses() {
    const { data } = await supabase.from('courses').select('*').order('name');
    setCourses(data || []);
    if (data && data.length > 0 && !selectedCourseId) {
      setSelectedCourseId(data[0].id);
    }
  }

  async function fetchActivities(courseId) {
    setLoading(true);
    const { data } = await supabase
      .from('activity_types')
      .select('*')
      .eq('course_id', courseId)
      .order('eixo', { ascending: true })
      .order('description', { ascending: true });
    
    setActivities(data || []);
    setLoading(false);
  }

  // --- NOVA FUNÇÃO: EXCLUIR REGRA ---
  const handleDelete = async (id, description) => {
    const confirmMessage = `Tem certeza que deseja EXCLUIR a regra:\n"${description}"?\n\nCuidado: Isso é irreversível.`;
    if (!confirm(confirmMessage)) return;

    try {
      const { error } = await supabase
        .from('activity_types')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert("Regra excluída com sucesso!");
      fetchActivities(selectedCourseId);
    } catch (error) {
      alert("Erro ao excluir (Pode haver certificados vinculados, tente apenas inativar): " + error.message);
    }
  };

  // --- FUNÇÃO: CRIAR CURSO ---
  const handleCreateCourse = async () => {
    const nomeCurso = prompt("Nome do Novo Curso (ex: Engenharia Civil):");
    if (!nomeCurso) return;

    try {
      const { data, error } = await supabase
        .from('courses')
        .insert([{ name: nomeCurso }])
        .select()
        .single();

      if (error) throw error;

      alert(`Curso "${nomeCurso}" criado!`);
      await fetchCourses(); // Recarrega lista
      setSelectedCourseId(data.id); // Seleciona o novo curso

    } catch (error) {
      alert('Erro ao criar curso: ' + error.message);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedCourseId) return alert("Selecione ou crie um curso primeiro!");

    try {
      const payload = { ...formData, course_id: selectedCourseId };

      if (editingItem) {
        const { error } = await supabase.from('activity_types').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('activity_types').insert([payload]);
        if (error) throw error;
      }

      alert('Salvo com sucesso!');
      setIsModalOpen(false);
      fetchActivities(selectedCourseId);

    } catch (error) {
      alert('Erro ao salvar: ' + error.message);
    }
  };

  const openNew = () => {
    setEditingItem(null);
    setFormData({ eixo: 'Integrador', description: '', min_hours: 20, max_hours: 40, proof_type: '', is_active: true });
    setIsModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/dashboard/coordinator" className={styles.backLink}>← Voltar</Link>
          <h1>Configuração de Atividades</h1>
        </div>
        
        <div className={styles.courseSelector}>
          <label>Curso:</label>
          <div style={{display: 'flex', gap: '8px'}}>
            <select 
              value={selectedCourseId} 
              onChange={(e) => setSelectedCourseId(e.target.value)}
              disabled={courses.length === 0}
            >
              {courses.length === 0 && <option>Nenhum curso cadastrado</option>}
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            
            <button 
              onClick={handleCreateCourse}
              className={styles.btnSmall}
              title="Criar novo curso"
            >
              +
            </button>
          </div>
        </div>
      </header>

      <main className={styles.content}>
        <div className={styles.toolbar}>
          <h3>Regras Cadastradas ({activities.length})</h3>
          <button className={styles.btnPrimary} onClick={openNew}>+ Nova Atividade</button>
        </div>

        {courses.length === 0 ? (
          <div style={{textAlign: 'center', padding: '40px', color: '#666'}}>
            <p>Comece criando um Curso no botão <strong>+</strong> acima.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Eixo</th>
                  <th>Atividade</th>
                  <th>Mínimo</th>
                  <th>Teto</th>
                  <th>Comprovante</th>
                  <th>Status</th>
                  <th style={{textAlign:'right'}}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {activities.map(item => (
                  <tr key={item.id} className={!item.is_active ? styles.disabledRow : ''}>
                    <td><span className={styles.tag}>{item.eixo}</span></td>
                    <td className={styles.descCell}>{item.description}</td>
                    <td>{item.min_hours}h</td>
                    <td>{item.max_hours}h</td>
                    <td className={styles.proofCell}>{item.proof_type}</td>
                    <td>
                      {item.is_active ? 
                        <span className={styles.badgeActive}>Ativo</span> : 
                        <span className={styles.badgeInactive}>Inativo</span>
                      }
                    </td>
                    <td style={{textAlign:'right'}}>
                      <div style={{display:'flex', gap:'8px', justifyContent:'flex-end'}}>
                        <button className={styles.btnEdit} onClick={() => openEdit(item)}>
                          Editar
                        </button>
                        <button 
                          className={styles.btnDelete} 
                          onClick={() => handleDelete(item.id, item.description)}
                          title="Excluir Regra"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h2>{editingItem ? 'Editar Regra' : 'Nova Regra'}</h2>
            <form onSubmit={handleSave}>
              <div className={styles.formGroup}>
                <label>Eixo</label>
                <select value={formData.eixo} onChange={e => setFormData({...formData, eixo: e.target.value})}>
                  <option>Tecnológico</option>
                  <option>Integrador</option>
                  <option>Básico</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Descrição</label>
                <input required type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <label>Mínimo (h)</label>
                  <input required type="number" value={formData.min_hours} onChange={e => setFormData({...formData, min_hours: e.target.value})} />
                </div>
                <div className={styles.formGroup}>
                  <label>Teto Máximo (h)</label>
                  <input required type="number" value={formData.max_hours} onChange={e => setFormData({...formData, max_hours: e.target.value})} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Comprovante Exigido</label>
                <input required type="text" value={formData.proof_type} onChange={e => setFormData({...formData, proof_type: e.target.value})} />
              </div>
              <div className={styles.formGroupCheckbox}>
                <input type="checkbox" id="activeCheck" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                <label htmlFor="activeCheck">Ativo</label>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnCancel} onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className={styles.btnPrimary}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}