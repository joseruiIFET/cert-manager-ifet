'use client';

import { useState } from 'react';
import { IconFile } from '@/components/Icones/Icones';
import { useToast } from '@/components/Toast/Toast';
import { mensagemDeErro } from '@/lib/errors';
import { useServices } from '@/lib/services/useServices';

/** Abre o arquivo por URL assinada, gerada sob demanda (performance.md §4). */
export function FileLink({ fileRef, className }: { fileRef: string | null; className?: string }) {
  const { storage } = useServices();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!fileRef) return <span className={className}>Sem arquivo</span>;

  async function open() {
    setBusy(true);
    try {
      const url = await storage.getAccessUrl(fileRef as string);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(mensagemDeErro(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} onClick={open} disabled={busy}>
      <IconFile size={16} /> {busy ? 'Abrindo…' : 'Ver arquivo'}
    </button>
  );
}
