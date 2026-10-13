'use client';

import { useState } from 'react';
import { Modal } from '@/components/Modal/Modal';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  /** `danger` pinta o botão de vermelho (ação destrutiva/irreversível). */
  tone?: 'primary' | 'danger';
  /** Quando definido, exige um texto (ex.: motivo da rejeição) e o entrega ao confirmar. */
  reasonLabel?: string;
  onConfirm: (reason: string) => Promise<void> | void;
  onCancel: () => void;
}

/** Substitui confirm() e prompt(): confirmação com texto claro e, se preciso, motivo obrigatório. */
export function ConfirmDialog({
  title, message, confirmLabel, tone = 'primary', reasonLabel, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const needsReason = reasonLabel !== undefined;
  const invalid = needsReason && reason.trim().length < 3;

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <div className={styles.message}>{message}</div>
      {needsReason && (
        <div className="form-group">
          <label className="form-label" htmlFor="confirm-reason">{reasonLabel}</label>
          <textarea
            id="confirm-reason"
            className="form-input"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <span className="form-hint">Obrigatório — o aluno verá este texto.</span>
        </div>
      )}
      <div className={styles.actions}>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button
          type="button"
          className={tone === 'danger' ? 'btn-danger' : 'btn-primary'}
          onClick={handleConfirm}
          disabled={busy || invalid}
        >
          {busy ? 'Aguarde…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
