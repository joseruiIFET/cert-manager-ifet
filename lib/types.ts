/**
 * DTOs do domínio — a única forma que a UI conhece. Nada de snake_case do banco
 * nem de objetos do SDK do Supabase aqui (arch.md §1).
 */

export type Role = 'student' | 'coordinator';
export type CertificateStatus = 'pending' | 'approved' | 'rejected';
export type Axis = 'Tecnológico' | 'Integrador' | 'Básico';

export const AXES: Axis[] = ['Tecnológico', 'Integrador', 'Básico'];

/** Carga total de horas exigida. Fonte única até existir por curso (arch.md §5). */
export const TOTAL_REQUIRED_HOURS = 120;

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
}

export interface Course {
  id: string;
  name: string;
}

export interface ActivityType {
  id: string;
  courseId: string;
  axis: Axis;
  description: string;
  minHours: number;
  maxHours: number;
  proofType: string;
  isActive: boolean;
}

export interface Certificate {
  id: string;
  studentId: string;
  title: string;
  /** Texto de `activity_types.description` (vínculo por nome; migrar para FK). */
  category: string;
  hours: number;
  /** Caminho no bucket (novo) ou URL pública (legado). Resolver via storageService. */
  fileRef: string | null;
  status: CertificateStatus;
  feedback: string | null;
  createdAt: string;
}

/** Resumo leve de um aluno para a fila da coordenação. */
export interface StudentSummary {
  profile: Pick<Profile, 'id' | 'fullName' | 'email'>;
  pendingCount: number;
  approvedHours: number;
}

export interface CertificateInput {
  title: string;
  category: string;
  hours: number;
  fileRef: string | null;
}

export interface ActivityTypeInput {
  axis: Axis;
  description: string;
  minHours: number;
  maxHours: number;
  proofType: string;
  isActive: boolean;
}
