'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { EmptyState, Skeleton } from '@/components/Feedback/Feedback';
import { IconEdit, IconPlus, IconTrash } from '@/components/Icones/Icones';
import { Modal } from '@/components/Modal/Modal';
import { useToast } from '@/components/Toast/Toast';
import { mensagemDeErro } from '@/lib/errors';
import { useServices } from '@/lib/services/useServices';
import { AXES, type ActivityType, type ActivityTypeInput, type Axis, type Course } from '@/lib/types';
import styles from './ActivitiesManager.module.css';

interface Props {
  courses: Course[];
  initialCourseId: string | null;
  initialRules: ActivityType[];
}

const EMPTY_FORM: ActivityTypeInput = {
  axis: 'Integrador', description: '', minHours: 20, maxHours: 40, proofType: '', isActive: true,
};

export function ActivitiesManager({ courses: initialCourses, initialCourseId, initialRules }: Props) {
  const { activityTypes, courses: coursesService } = useServices();
  const toast = useToast();

  const [courses, setCourses] = useState(initialCourses);
  const [courseId, setCourseId] = useState(initialCourseId ?? '');
  const [rules, setRules] = useState(initialRules);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<{ editing: ActivityType | null; values: ActivityTypeInput } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [courseModal, setCourseModal] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [toDelete, setToDelete] = useState<ActivityType | null>(null);

  async function loadRules(id: string) {
    setLoading(true);
    try {
      setRules(await activityTypes.listByCourse(id));
    } catch (err) {
      toast.error(mensagemDeErro(err));
    } finally {
      setLoading(false);
    }
  }

  async function changeCourse(id: string) {
    setCourseId(id);
    await loadRules(id);
  }

  async function createCourse(e: React.FormEvent) {
    e.preventDefault();
    const name = courseName.trim();
    if (!name) return;
    try {
      const course = await coursesService.create(name);
      setCourses((prev) => [...prev, course].sort((a, b) => a.name.localeCompare(b.name)));
      setCourseModal(false);
      setCourseName('');
      toast.success(`Curso “${course.name}” criado.`);
      await changeCourse(course.id);
    } catch (err) {
      toast.error(mensagemDeErro(err));
    }
  }

  async function saveRule(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !courseId) return;
    const v = form.values;
    if (v.minHours < 0 || v.maxHours < v.minHours) {
      setFormError('O teto deve ser maior ou igual ao mínimo.');
      return;
    }
    try {
      if (form.editing) await activityTypes.update(form.editing.id, v);
      else await activityTypes.create(courseId, v);
      setForm(null);
      setFormError(null);
      toast.success('Regra salva.');
      await loadRules(courseId);
    } catch (err) {
      setFormError(mensagemDeErro(err));
    }
  }

  async function deleteRule() {
    if (!toDelete) return;
    try {
      await activityTypes.remove(toDelete.id);
      toast.success('Regra excluída.');
      setToDelete(null);
      await loadRules(courseId);
    } catch (err) {
      setToDelete(null);
      toast.error(mensagemDeErro(err));
    }
  }

  async function deactivate(rule: ActivityType) {
    try {
      await activityTypes.update(rule.id, { ...rule, isActive: false });
      toast.success('Regra inativada.');
      await loadRules(courseId);
    } catch (err) {
      toast.error(mensagemDeErro(err));
    }
  }

  const setValue = <K extends keyof ActivityTypeInput>(key: K, value: ActivityTypeInput[K]) =>
    setForm((f) => (f ? { ...f, values: { ...f.values, [key]: value } } : f));

  return (
    <div>
      <header className={styles.toolbar}>
        <div className={styles.course}>
          <label className="form-label" htmlFor="course">Curso</label>
          <div className={styles.courseRow}>
            <select
              id="course"
              className="form-select"
              value={courseId}
              onChange={(e) => changeCourse(e.target.value)}
              disabled={courses.length === 0}
            >
              {courses.length === 0 && <option>Nenhum curso cadastrado</option>}
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" className="btn-secondary" onClick={() => setCourseModal(true)}>
              <IconPlus size={16} /> Novo curso
            </button>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={!courseId}
          onClick={() => { setFormError(null); setForm({ editing: null, values: EMPTY_FORM }); }}
        >
          <IconPlus size={16} /> Nova atividade
        </button>
      </header>

      <h2 className={styles.heading}>Regras cadastradas ({rules.length})</h2>

      {courses.length === 0 ? (
        <EmptyState title="Nenhum curso ainda" hint="Comece criando um curso em “Novo curso”." />
      ) : loading ? (
        <Skeleton rows={4} height={56} />
      ) : rules.length === 0 ? (
        <EmptyState title="Este curso ainda não tem regras" hint="Use “Nova atividade” para cadastrar." />
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Eixo</th><th>Atividade</th><th>Mínimo</th><th>Teto</th><th>Comprovante</th><th>Status</th>
                <th className={styles.right}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className={r.isActive ? '' : styles.disabledRow}>
                  <td data-label="Eixo"><span className={styles.tag}>{r.axis}</span></td>
                  <td data-label="Atividade">{r.description}</td>
                  <td data-label="Mínimo">{r.minHours} h</td>
                  <td data-label="Teto">{r.maxHours} h</td>
                  <td data-label="Comprovante">{r.proofType}</td>
                  <td data-label="Status">
                    <span className={r.isActive ? styles.active : styles.inactive}>
                      {r.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className={styles.right}>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => { setFormError(null); setForm({ editing: r, values: { axis: r.axis, description: r.description, minHours: r.minHours, maxHours: r.maxHours, proofType: r.proofType, isActive: r.isActive } }); }}
                      >
                        <IconEdit size={16} /> Editar
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => setToDelete(r)} aria-label={`Excluir ${r.description}`}>
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {courseModal && (
        <Modal title="Novo curso" onClose={() => setCourseModal(false)}>
          <form onSubmit={createCourse}>
            <div className="form-group">
              <label className="form-label" htmlFor="course-name">Nome do curso</label>
              <input id="course-name" className="form-input" value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="Ex.: Engenharia Civil" required />
            </div>
            <div className={styles.modalActions}>
              <button type="button" className="btn-secondary" onClick={() => setCourseModal(false)}>Cancelar</button>
              <button type="submit" className="btn-primary">Criar curso</button>
            </div>
          </form>
        </Modal>
      )}

      {form && (
        <Modal title={form.editing ? 'Editar regra' : 'Nova regra'} onClose={() => setForm(null)}>
          <form onSubmit={saveRule}>
            {formError && <div className="alert-error" role="alert">{formError}</div>}
            <div className="form-group">
              <label className="form-label" htmlFor="rule-axis">Eixo</label>
              <select id="rule-axis" className="form-select" value={form.values.axis} onChange={(e) => setValue('axis', e.target.value as Axis)}>
                {AXES.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="rule-desc">Descrição</label>
              <input id="rule-desc" className="form-input" required value={form.values.description} onChange={(e) => setValue('description', e.target.value)} />
            </div>
            <div className={styles.row}>
              <div className="form-group">
                <label className="form-label" htmlFor="rule-min">Mínimo (h)</label>
                <input id="rule-min" className="form-input" required type="number" min={0} value={form.values.minHours} onChange={(e) => setValue('minHours', Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="rule-max">Teto máximo (h)</label>
                <input id="rule-max" className="form-input" required type="number" min={0} value={form.values.maxHours} onChange={(e) => setValue('maxHours', Number(e.target.value))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="rule-proof">Comprovante exigido</label>
              <input id="rule-proof" className="form-input" required value={form.values.proofType} onChange={(e) => setValue('proofType', e.target.value)} />
            </div>
            <label className={styles.check}>
              <input type="checkbox" checked={form.values.isActive} onChange={(e) => setValue('isActive', e.target.checked)} />
              Ativo (aparece para os alunos)
            </label>
            <div className={styles.modalActions}>
              <button type="button" className="btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit" className="btn-primary">Salvar</button>
            </div>
          </form>
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Excluir regra"
          tone="danger"
          confirmLabel="Excluir"
          message={
            <>
              Excluir <b>{toDelete.description}</b>? A ação é irreversível. Se já houver certificados
              vinculados, a exclusão será recusada — nesse caso{' '}
              {toDelete.isActive ? (
                <button type="button" className={styles.linkBtn} onClick={() => { const r = toDelete; setToDelete(null); deactivate(r); }}>
                  inative a regra
                </button>
              ) : 'a regra já está inativa'}.
            </>
          }
          onConfirm={deleteRule}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
