'use client';

import { useMemo, useState } from 'react';
import { IconClock, IconInfo, IconWarning } from '@/components/Icones/Icones';
import { Modal } from '@/components/Modal/Modal';
import { useToast } from '@/components/Toast/Toast';
import { calculateHoursForCertificate } from '@/lib/domain/hoursCalculation';
import { mensagemDeErro } from '@/lib/errors';
import { useServices } from '@/lib/services/useServices';
import { ALLOWED_MIME, MAX_FILE_BYTES, validateFile } from '@/lib/services/storageService';
import type { ActivityType, Certificate, CertificateInput } from '@/lib/types';
import styles from './CertificateFormModal.module.css';

interface Props {
  studentId: string;
  editing: Certificate | null;
  activityTypes: ActivityType[];
  certificates: Certificate[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

type FieldErrors = Partial<Record<'type' | 'title' | 'hours' | 'file', string>>;

const AXIS_BADGE_CLASS: Record<string, string> = {
  Tecnológico: styles.axisTecnologico,
  Integrador: styles.axisIntegrador,
  Básico: styles.axisBasico,
};

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  const formatter = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatter.format(mb)} MB`;
}

export function CertificateFormModal({
  studentId,
  editing,
  activityTypes,
  certificates,
  onClose,
  onSaved,
}: Props) {
  const { certificates: certificatesService, storage } = useServices();
  const toast = useToast();

  const initialRule = editing
    ? activityTypes.find((t) => t.id === editing.activityTypeId || t.description === editing.category)
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

  // Cálculo das horas aproveitáveis, excedentes e cotas em tempo real
  const calculation = useMemo(() => {
    if (!rule) return null;
    return calculateHoursForCertificate({
      declaredHours: Number.isInteger(hoursNumber) ? hoursNumber : 0,
      rule,
      studentCertificates: certificates,
      currentCertId: editing?.id,
    });
  }, [rule, hoursNumber, certificates, editing?.id]);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!typeId) next.type = 'Selecione o tipo de atividade.';
    if (!title.trim()) next.title = 'Preencha o título do certificado.';
    if (!Number.isInteger(hoursNumber) || hoursNumber <= 0) {
      next.hours = 'Informe a quantidade de horas (deve ser um número inteiro maior que zero).';
    }
    if (!editing && !file) next.file = 'Selecione o arquivo do comprovante (PDF, PNG ou JPG).';
    if (file) {
      try {
        validateFile(file);
      } catch (err) {
        next.file = mensagemDeErro(err);
      }
    }
    return next;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] ?? null;

    if (!selectedFile) {
      setFile(null);
      return;
    }

    try {
      validateFile(selectedFile);
      setFile(selectedFile);
      setErrors((prev) => ({ ...prev, file: undefined }));
    } catch (err) {
      setFile(null);
      setErrors((prev) => ({ ...prev, file: mensagemDeErro(err) }));
      e.target.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);

    if (Object.keys(found).length > 0 || !rule) {
      toast.error('Por favor, preencha corretamente todos os campos destacados.');
      return;
    }

    if (calculation?.isBlockedByQuota) {
      toast.error(calculation.quotaWarning ?? 'O limite acumulado desta atividade já foi atingido.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const fileRef = file ? await storage.upload(studentId, file) : (editing?.fileRef ?? null);

      const input: CertificateInput = {
        title: title.trim(),
        category: rule.description,
        activityTypeId: rule.id,
        hours: hoursNumber,
        fileRef,
      };

      if (editing) {
        await certificatesService.resubmit(editing.id, input);
        onSaved('Certificado corrigido com sucesso! Ele foi reenviado para análise da coordenação.');
      } else {
        await certificatesService.create(studentId, input);
        onSaved('Certificado enviado com sucesso! Ele já está disponível para análise da coordenação.');
      }
    } catch (err) {
      const msg = mensagemDeErro(
        err,
        editing
          ? 'Não foi possível salvar as correções do certificado. Por favor, tente novamente.'
          : 'Não foi possível enviar o certificado. Por favor, tente novamente.'
      );
      setFormError(msg);
      toast.error(msg);
      setSaving(false);
    }
  }

  const typeDescribedBy = [
    errors.type && 'cert-type-err',
    rule && 'cert-type-rule',
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  const hoursDescribedBy = [
    errors.hours && 'cert-hours-err',
    calculation && 'cert-hours-calc',
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  const fileDescribedBy = [
    'cert-file-hint',
    errors.file && 'cert-file-err',
    file && 'cert-file-selected',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Modal title={editing ? 'Corrigir certificado' : 'Enviar novo certificado'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate aria-busy={saving}>
        {formError && <div className="alert-error" role="alert">{formError}</div>}

        {/* Tipo de atividade */}
        <div className="form-group">
          <label className="form-label" htmlFor="cert-type">Tipo de atividade</label>
          <select
            id="cert-type"
            className="form-select"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            disabled={saving}
            aria-invalid={!!errors.type}
            aria-describedby={typeDescribedBy}
          >
            <option value="">— Selecione a atividade —</option>
            {activityTypes.map((t) => (
              <option key={t.id} value={t.id}>
                [{t.axis}] {t.description}
              </option>
            ))}
          </select>
          {errors.type && <span id="cert-type-err" className={styles.error}>{errors.type}</span>}

          {/* Resumo dinâmico das regras aplicáveis */}
          {rule && (
            <div id="cert-type-rule" className={styles.ruleBox} aria-label="Resumo das regras da atividade">
              <div className={styles.ruleHeader}>
                <span className={`${styles.axisTag} ${AXIS_BADGE_CLASS[rule.axis] ?? ''}`}>
                  Eixo {rule.axis}
                </span>
                <span className={styles.ruleTitle}>{rule.description}</span>
              </div>

              <div className={styles.ruleGrid}>
                <div className={styles.ruleItem}>
                  <span className={styles.ruleLabel}>Mínimo por cert.:</span>
                  <strong>{rule.minHours} h</strong>
                </div>
                <div className={styles.ruleItem}>
                  <span className={styles.ruleLabel}>Teto por cert.:</span>
                  <strong>{rule.maxHours} h</strong>
                </div>
                <div className={styles.ruleItemFull}>
                  <span className={styles.ruleLabel}>Comprovante exigido:</span>
                  <em>{rule.proofType}</em>
                </div>

                {/* Exibição de limites acumulados se definidos no PPC */}
                {typeof rule.maxAccumulatedHours === 'number' && rule.maxAccumulatedHours > 0 && calculation && (
                  <div className={styles.quotaBlock}>
                    <div className={styles.quotaRow}>
                      <span>Limite acumulado da atividade:</span>
                      <strong>{rule.maxAccumulatedHours} h</strong>
                    </div>
                    <div className={styles.quotaRow}>
                      <span>Horas já reconhecidas (aprovadas):</span>
                      <strong>{calculation.activityApprovedHours} h</strong>
                    </div>
                    {calculation.activityPendingHours > 0 && (
                      <div className={styles.quotaRow}>
                        <span>Horas reservadas (em análise):</span>
                        <strong>{calculation.activityPendingHours} h</strong>
                      </div>
                    )}
                    <div className={styles.quotaRowRemaining}>
                      <span>Saldo disponível para contabilização:</span>
                      <strong className={calculation.activityRemainingHours === 0 ? styles.zeroBalance : styles.positiveBalance}>
                        {calculation.activityRemainingHours} h
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Título do certificado */}
        <div className="form-group">
          <label className="form-label" htmlFor="cert-title">Título do certificado ou evento</label>
          <input
            id="cert-title"
            className="form-input"
            placeholder="Ex.: Curso de React Avançado, Palestra sobre IA..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'cert-title-err' : undefined}
          />
          {errors.title && <span id="cert-title-err" className={styles.error}>{errors.title}</span>}
        </div>

        {/* Carga horária declarada */}
        <div className="form-group">
          <label className="form-label" htmlFor="cert-hours">Horas declaradas no certificado</label>
          <input
            id="cert-hours"
            className="form-input"
            type="number"
            min={1}
            placeholder="Ex.: 20"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            disabled={saving}
            aria-invalid={!!errors.hours}
            aria-describedby={hoursDescribedBy}
          />
          {errors.hours && <span id="cert-hours-err" className={styles.error}>{errors.hours}</span>}

          {/* Avisos e cálculos das regras de horas */}
          {calculation && hoursNumber > 0 && (
            <div id="cert-hours-calc" className={styles.calcFeedback} role="status">
              {/* 1. Aviso de horas abaixo do mínimo (NÃO bloqueia o formulário) */}
              {calculation.isBelowMin && (
                <div className={styles.infoAlert}>
                  <IconInfo size={16} className={styles.alertIcon} />
                  <div>
                    <strong>Carga horária abaixo do mínimo:</strong> Você declarou {calculation.declaredHours} h,
                    abaixo do mínimo de {calculation.minHours} h configurado para esta atividade. O envio é
                    permitido e será analisado pela coordenação segundo os critérios do PPC.
                  </div>
                </div>
              )}

              {/* 2. Aviso de horas acima do teto individual ou saldo da quota */}
              {calculation.excessHours > 0 && !calculation.isBlockedByQuota && (
                <div className={styles.warnAlert}>
                  <IconWarning size={16} className={styles.alertIcon} />
                  <div>
                    <strong>Aproveitamento de horas:</strong> Você declarou {calculation.declaredHours} h.
                    Conforme as regras aplicáveis, serão propostas{' '}
                    <strong>{calculation.recognizedHours} h</strong> para reconhecimento.
                    As <strong>{calculation.excessHours} h excedentes</strong> serão desconsideradas para contabilização.
                  </div>
                </div>
              )}

              {/* 3. Bloqueio quando o saldo acumulado estiver 100% esgotado */}
              {calculation.isBlockedByQuota && (
                <div className={styles.errorAlert} role="alert">
                  <IconWarning size={16} className={styles.alertIcon} />
                  <div>
                    <strong>Saldo esgotado:</strong> {calculation.quotaWarning}
                  </div>
                </div>
              )}

              {/* 4. Indicação de horas regulares */}
              {!calculation.isBelowMin && calculation.excessHours === 0 && !calculation.isBlockedByQuota && (
                <div className={styles.successNote}>
                  <IconClock size={14} /> Todas as {calculation.declaredHours} h declaradas estão dentro dos limites e poderão ser aproveitadas após aprovação.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Anexo do comprovante */}
        <div className="form-group">
          <label className="form-label" htmlFor="cert-file">
            Comprovante{editing && ' (deixe vazio para manter o arquivo atual)'}
          </label>
          <input
            id="cert-file"
            className="form-input"
            type="file"
            accept={ALLOWED_MIME.join(',')}
            onChange={handleFileChange}
            disabled={saving}
            aria-invalid={!!errors.file}
            aria-describedby={fileDescribedBy}
          />
          {file && (
            <span id="cert-file-selected" className={styles.fileSelected}>
              {file.name} · {formatBytes(file.size)}
            </span>
          )}
          <span id="cert-file-hint" className="form-hint">
            Formatos aceitos: PDF, PNG ou JPG (até {MAX_FILE_BYTES / 1024 / 1024} MB).
            {editing && !file && ' O arquivo atual será mantido se nenhum novo for selecionado.'}
          </span>
          {errors.file && <span id="cert-file-err" className={styles.error}>{errors.file}</span>}
        </div>

        {/* Ações do modal */}
        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || (calculation?.isBlockedByQuota ?? false)}
          >
            {saving ? (
              <><span className="spinner" /> Salvando…</>
            ) : editing ? (
              'Salvar correção'
            ) : (
              'Enviar certificado'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
