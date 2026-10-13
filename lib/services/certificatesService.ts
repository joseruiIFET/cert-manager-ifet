import type { SupabaseClient } from '@supabase/supabase-js';
import { toAppError } from '@/lib/errors';
import type {
  Certificate,
  CertificateInput,
  CertificateStatus,
  StudentSummary,
} from '@/lib/types';
import { mapStudentProfile } from './profilesService';

interface CertificateRow {
  id: string;
  student_id: string;
  title: string;
  category: string;
  hours: number;
  file_url: string | null;
  status: CertificateStatus;
  feedback: string | null;
  created_at: string;
}

const COLUMNS = 'id, student_id, title, category, hours, file_url, status, feedback, created_at';

/** Mapper único: list/listByStudent devolvem exatamente o mesmo DTO (arch.md §1). */
function _mapCertificate(row: CertificateRow): Certificate {
  return {
    id: row.id,
    studentId: row.student_id,
    title: row.title,
    category: row.category,
    hours: row.hours,
    fileRef: row.file_url,
    status: row.status,
    feedback: row.feedback,
    createdAt: row.created_at,
  };
}

export function createCertificatesService(db: SupabaseClient) {
  return {
    /** Certificados do aluno logado (a RLS restringe; o filtro explícito evita ler dados alheios). */
    async listByStudent(studentId: string, limit = 200): Promise<Certificate[]> {
      const { data, error } = await db
        .from('certificates')
        .select(COLUMNS)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw toAppError(error, 'Não foi possível carregar seus certificados.');
      return (data as CertificateRow[]).map(_mapCertificate);
    },

    /**
     * Fila da coordenação: só colunas leves, para montar o resumo por aluno.
     * Agregação final no cliente é provisória — migrar para a view `student_review_summary`
     * (ver supabase/proposals/001_estrutura_proposta.sql).
     */
    async listStudentSummaries(): Promise<StudentSummary[]> {
      const { data, error } = await db
        .from('certificates')
        .select('status, hours, profiles!inner(id, full_name, email, role)')
        .order('created_at', { ascending: true });
      if (error) throw toAppError(error, 'Não foi possível carregar os alunos.');

      const map = new Map<string, StudentSummary>();
      for (const raw of data as unknown as Array<{
        status: CertificateStatus;
        hours: number;
        profiles: { id: string; full_name: string | null; email: string | null; role: string | null };
      }>) {
        const id = raw.profiles.id;
        let entry = map.get(id);
        if (!entry) {
          entry = { profile: mapStudentProfile(raw.profiles), pendingCount: 0, approvedHours: 0 };
          map.set(id, entry);
        }
        if (raw.status === 'pending') entry.pendingCount += 1;
        if (raw.status === 'approved') entry.approvedHours += raw.hours;
      }
      return [...map.values()].sort((a, b) => b.pendingCount - a.pendingCount);
    },

    async create(studentId: string, input: CertificateInput): Promise<void> {
      const { error } = await db.from('certificates').insert([
        {
          student_id: studentId,
          title: input.title,
          category: input.category,
          hours: input.hours,
          file_url: input.fileRef,
          status: 'pending',
        },
      ]);
      if (error) throw toAppError(error, 'Não foi possível enviar o certificado.');
    },

    /** Correção pelo aluno: volta para análise. */
    async resubmit(id: string, input: CertificateInput): Promise<void> {
      const { error } = await db
        .from('certificates')
        .update({
          title: input.title,
          category: input.category,
          hours: input.hours,
          file_url: input.fileRef,
          status: 'pending',
        })
        .eq('id', id);
      if (error) throw toAppError(error, 'Não foi possível corrigir o certificado.');
    },

    async approve(id: string): Promise<void> {
      const { error } = await db.from('certificates').update({ status: 'approved' }).eq('id', id);
      if (error) throw toAppError(error, 'Não foi possível aprovar o certificado.');
    },

    /** Rejeita com motivo; o motivo novo vai no topo do histórico de correções. */
    async reject(cert: Pick<Certificate, 'id' | 'feedback'>, reason: string): Promise<string> {
      const today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const entry = `[${today}] ${reason}`;
      const feedback = cert.feedback ? `${entry}\n----------------\n${cert.feedback}` : entry;
      const { error } = await db
        .from('certificates')
        .update({ status: 'rejected', feedback })
        .eq('id', cert.id);
      if (error) throw toAppError(error, 'Não foi possível rejeitar o certificado.');
      return feedback;
    },
  };
}

export type CertificatesService = ReturnType<typeof createCertificatesService>;
