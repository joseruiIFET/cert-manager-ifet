'use client';

import { useState } from 'react';
import { Modal } from '@/components/Modal/Modal';
import { mensagemDeErro } from '@/lib/errors';
import { useServices } from '@/lib/services/useServices';
import { ALLOWED_MIME, MAX_FILE_BYTES, validateFile } from '@/lib/services/storageService';
import type { ActivityType, Certificate } from '@/lib/types';
import styles from './CertificateFormModal.module.css';

interface Props {
  studentId: string;
  editing: Certificate | null;
  activityTypes: ActivityType[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

type FieldErrors = Partial<Record<'type' | 'title' | 'hours' | 'file', string>>;

export function CertificateFormModal({ studentId, editing, activityTypes, onClose, onSaved }: Props) {
  const { certificates, storage } = useServices();

  const initialRule = editing
    ? activityTypes.find((t) => t.description === editing.category)
    : undefined;
  const [typeId, setTypeId] = useState(initialRule?.id ?? '');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [hours, setHours] = useState(editing ? String(editing.hours) : '');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const rule = activityTypes.find((t) => t.id === typeId);
  const hoursNumber = Number(hours);
  const hint =
    rule && hours && hoursNumber > 0
      ? hoursNumber < rule.minHours
        ? `Abaixo do mínimo de ${rule.minHours} h — a coordenação poderá rejeitar.`
        : hoursNumber > rule.maxHours
          ? `Acima do teto de ${rule.maxHours} h — a coordenação poderá limitar.`
          : null
      : null;

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!typeId) next.type = 'Selecione o tipo de atividade.';
    if (!title.trim()) next.title = 'Preencha o título.';
    if (!Number.isInteger(hoursNumber) || hoursNumber <= 0) next.hours = 'Informe as horas (número inteiro maior que zero).';
    if (!editing && !file) next.file = 'Selecione um arquivo.';
    if (file) {
      try { validateFile(file); } catch (err) { next.file = mensagemDeErro(err); }
    }
    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !rule) return;

    setSaving(true);
    setFormError(null);
    try {
      const fileRef = file ? await storage.upload(studentId, file) : (editing?.fileRef ?? null);
      const input = { title: title.trim(), category: rule.description, hours: hoursNumber, fileRef };

      if (editing) {
        await certificates.resubmit(editing.id, input);
        onSaved('Certificado corrigido e reenviado para análise.');
      } else {
        await certificates.create(studentId, input);
        onSaved('Certificado enviado com sucesso.');
      }
    } catch (err) {
      setFormError(mensagemDeErro(err));
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? 'Corrigir certificado' : 'Enviar novo certificado'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        {formError && <div className="alert-error" role="alert">{formError}</div>}

        <div className="form-group">
          <label className="form-label" htmlFor="cert-type">Tipo de atividade</label>
          <select
            id="cert-type"
            className="form-select"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            aria-invalid={!!errors.type}
            aria-describedby={errors.type ? 'cert-type-err' : undefined}
          >
            <option value="">— Selecione —</option>
            {activityTypes.map((t) => <option key={t.id} value={t.id}>{t.description}</option>)}
          </select>
          {errors.type && <span id="cert-type-err" className={styles.error}>{errors.type}</span>}
          {rule && (
            <div className={styles.rule}>
              Mínimo <b>{rule.minHours} h</b> · Teto <b>{rule.maxHours} h</b> · Exige <em>{rule.proofType}</em>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="cert-title">Título</label>
          <input
            id="cert-title"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'cert-title-err' : undefined}
          />
          {errors.title && <span id="cert-title-err" className={styles.error}>{errors.title}</span>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="cert-hours">Horas</label>
          <input
            id="cert-hours"
            className="form-input"
            type="number"
            min={1}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            aria-invalid={!!errors.hours}
            aria-describedby={errors.hours ? 'cert-hours-err' : undefined}
          />
          {errors.hours && <span id="cert-hours-err" className={styles.error}>{errors.hours}</span>}
          {hint && <span className={styles.warning}>{hint}</span>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="cert-file">
            Arquivo{editing && ' (deixe vazio para manter o atual)'}
          </label>
          <input
            id="cert-file"
            className="form-input"
            type="file"
            accept={ALLOWED_MIME.join(',')}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            aria-invalid={!!errors.file}
            aria-describedby="cert-file-hint"
          />
          <span id="cert-file-hint" className="form-hint">
            PDF, PNG ou JPG, até {MAX_FILE_BYTES / 1024 / 1024} MB.
            {editing && !file && ' Arquivo atual mantido.'}
          </span>
          {errors.file && <span className={styles.error}>{errors.file}</span>}
        </div>

        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <><span className="spinner" /> Salvando…</> : editing ? 'Salvar correção' : 'Enviar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
