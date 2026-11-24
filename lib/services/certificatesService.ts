import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, toAppError } from '@/lib/errors';
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
  activity_type_id?: string | null;
  title: string;
  category: string;
  hours: number;
  recognized_hours?: number | null;
  file_url: string | null;
  status: CertificateStatus;
  feedback: string | null;
  created_at: string;
}

const FULL_COLUMNS =
  'id, student_id, title, category, hours, file_url, status, feedback, created_at, activity_type_id, recognized_hours';
const ALREADY_DECIDED =
  'Este certificado já foi analisado por outra pessoa da coordenação. Atualize a página para ver a decisão.';

const BASE_COLUMNS =
  'id, student_id, title, category, hours, file_url, status, feedback, created_at';

/** Mapper único: list/listByStudent devolvem exatamente o mesmo DTO (arch.md §1). */
function _mapCertificate(row: CertificateRow): Certificate {
  return {
    id: row.id,
    studentId: row.student_id,
    activityTypeId: row.activity_type_id ?? null,
    title: row.title,
    category: row.category,
    hours: row.hours,
    recognizedHours:
      typeof row.recognized_hours === 'number'
        ? row.recognized_hours
        : row.status === 'approved'
          ? row.hours
          : null,
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
      let data: unknown[] | null = null;
      const res = await db
        .from('certificates')
        .select(FULL_COLUMNS)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (res.error && (res.error.code === '42703' || res.error.message?.includes('column'))) {
        const fallback = await db
          .from('certificates')
          .select(BASE_COLUMNS)
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (fallback.error) {
          throw toAppError(fallback.error, 'Não foi possível carregar a lista de certificados. Tente atualizar a página.');
        }
        data = fallback.data as unknown[];
      } else if (res.error) {
        throw toAppError(res.error, 'Não foi possível carregar a lista de certificados. Tente atualizar a página.');
      } else {
        data = res.data as unknown[];
      }

      return ((data ?? []) as CertificateRow[]).map(_mapCertificate);
    },

    /**
     * Fila da coordenação: só colunas leves, para montar o resumo por aluno.
     * Agregação no cliente considera as horas aprovadas reconhecidas.
     */
    async listStudentSummaries(): Promise<StudentSummary[]> {
      const { data, error } = await db
        .from('certificates')
        // certificates tem duas FKs para profiles (student_id e reviewed_by): a dica com o
        // nome da FK diz ao PostgREST qual relação usar. Sem ela, a consulta falha por ambiguidade.
        .select(
          'status, hours, recognized_hours, profiles!certificates_student_id_fkey!inner(id, full_name, email, role)'
        )
        .order('created_at', { ascending: true });
      if (error) {
        throw toAppError(error, 'Não foi possível carregar o resumo dos alunos. Tente atualizar a página.');
      }

      const map = new Map<string, StudentSummary>();
      for (const raw of data as unknown as Array<{
        status: CertificateStatus;
        hours: number;
        recognized_hours?: number | null;
        profiles: { id: string; full_name: string | null; email: string | null; role: string | null };
      }>) {
        const id = raw.profiles.id;
        let entry = map.get(id);
        if (!entry) {
          entry = { profile: mapStudentProfile(raw.profiles), pendingCount: 0, approvedHours: 0 };
          map.set(id, entry);
        }
        if (raw.status === 'pending') entry.pendingCount += 1;
        if (raw.status === 'approved') entry.approvedHours += raw.recognized_hours ?? raw.hours;
      }
      return [...map.values()].sort((a, b) => b.pendingCount - a.pendingCount);
    },

    async create(studentId: string, input: CertificateInput): Promise<void> {
      const payload: Record<string, unknown> = {
        student_id: studentId,
        title: input.title,
        category: input.category,
        hours: input.hours,
        file_url: input.fileRef,
        status: 'pending',
      };
      // recognized_hours NÃO é enviado: o banco calcula (trigger calcular_horas_reconhecidas).
      if (input.activityTypeId) payload.activity_type_id = input.activityTypeId;

      let { error } = await db.from('certificates').insert([payload]);

      if (error && error.code === '42703') {
        delete payload.activity_type_id;
        const res = await db.from('certificates').insert([payload]);
        error = res.error;
      }

      if (error) {
        throw toAppError(error, 'Não foi possível enviar o certificado. Verifique os dados e tente novamente.');
      }
    },

    /** Correção pelo aluno: só de certificado rejeitado, e volta para análise. */
    async resubmit(id: string, input: CertificateInput): Promise<void> {
      const payload: Record<string, unknown> = {
        title: input.title,
        category: input.category,
        hours: input.hours,
        file_url: input.fileRef,
        status: 'pending',
      };
      if (input.activityTypeId) payload.activity_type_id = input.activityTypeId;

      let res = await db.from('certificates').update(payload).eq('id', id).eq('status', 'rejected').select('id');

      if (res.error && res.error.code === '42703') {
        delete payload.activity_type_id;
        res = await db.from('certificates').update(payload).eq('id', id).eq('status', 'rejected').select('id');
      }

      if (res.error) {
        throw toAppError(res.error, 'Não foi possível salvar a correção do certificado. Tente novamente.');
      }
      if (!res.data || res.data.length === 0) {
        throw new AppError('Este certificado não está mais disponível para correção. Atualize a página.');
      }
    },

    /**
     * Aprova um certificado pendente. As horas reconhecidas são calculadas pelo banco
     * (teto por certificado e saldo acumulado) e devolvidas para exibição.
     * `.eq('status', 'pending')` impede decidir duas vezes o mesmo certificado.
     */
    async approve(id: string): Promise<number> {
      const { data, error } = await db
        .from('certificates')
        .update({ status: 'approved' })
        .eq('id', id)
        .eq('status', 'pending')
        .select('hours, recognized_hours');

      if (error) {
        throw toAppError(error, 'Não foi possível registrar a aprovação do certificado. Tente novamente.');
      }
      const row = (data as Array<{ hours: number; recognized_hours?: number | null }> | null)?.[0];
      if (!row) throw new AppError(ALREADY_DECIDED);
      return typeof row.recognized_hours === 'number' ? row.recognized_hours : row.hours;
    },

    /** Rejeita com motivo; o motivo novo vai no topo do histórico de correções. */
    async reject(cert: Pick<Certificate, 'id' | 'feedback'>, reason: string): Promise<string> {
      const today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const entry = `[${today}] ${reason}`;
      const feedback = cert.feedback ? `${entry}\n----------------\n${cert.feedback}` : entry;
      const { data, error } = await db
        .from('certificates')
        .update({ status: 'rejected', feedback })
        .eq('id', cert.id)
        .eq('status', 'pending')
        .select('id');
      if (error) {
        throw toAppError(error, 'Não foi possível registrar a rejeição do certificado. Tente novamente.');
      }
      if (!data || data.length === 0) throw new AppError(ALREADY_DECIDED);
      return feedback;
    },
  };
}

export type CertificatesService = ReturnType<typeof createCertificatesService>;
