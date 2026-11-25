'use client';

import { useEffect, useId, useRef } from 'react';
import { IconX } from '@/components/Icones/Icones';
import styles from './Modal.module.css';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Bloqueia o fechamento via Esc, overlay ou botão X durante operações críticas/assíncronas. */
  disableClose?: boolean;
}

/** Diálogo acessível: foco preso, Esc fecha, aria-modal, rolagem do fundo travada. */
export function Modal({ title, onClose, children, disableClose = false }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusable = () =>
      node?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      ) ?? [];

    focusable()[0]?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Bloqueia fechamento quando disableClose for true (ex.: decisão em voo + Esc = duplo applyDecision)
        if (disableClose) return;
        return onClose();
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(focusable());
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose, disableClose]);

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (!disableClose && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div ref={ref} className={styles.box} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className={styles.close}
            onClick={disableClose ? undefined : onClose}
            disabled={disableClose}
            aria-disabled={disableClose ? 'true' : undefined}
            aria-label="Fechar"
          >
            <IconX />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
