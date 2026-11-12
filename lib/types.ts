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
  matricula?: string;
}

export interface Course {
  id: string;
  name: string;
  totalHours?: number;
}

export interface ActivityType {
  id: string;
  courseId: string;
  axis: Axis;
  description: string;
  minHours: number;
  maxHours: number;
  maxAccumulatedHours?: number | null;
  proofType: string;
  isActive: boolean;
}

export interface Certificate {
  id: string;
  studentId: string;
  activityTypeId?: string | null;
  title: string;
  /** Texto de `activity_types.description` (mantido para redundância e retrocompatibilidade). */
  category: string;
  /** Horas declaradas pelo estudante. */
  hours: number;
  /** Horas efetivamente reconhecidas/propostas para reconhecimento. */
  recognizedHours?: number | null;
  /** Caminho no bucket (novo) ou URL pública (legado). Resolver via storageService. */
  fileRef: string | null;
  status: CertificateStatus;
  feedback: string | null;
  createdAt: string;
}

/** Resumo leve de um aluno para a fila da coordenação. */
export interface StudentSummary {
  profile: Pick<Profile, 'id' | 'fullName' | 'email'> & { matricula?: string };
  pendingCount: number;
  approvedHours: number;
}

export interface CertificateInput {
  title: string;
  category: string;
  activityTypeId?: string | null;
  hours: number;
  recognizedHours?: number | null;
  fileRef: string | null;
}

export interface ActivityTypeInput {
  axis: Axis;
  description: string;
  minHours: number;
  maxHours: number;
  maxAccumulatedHours?: number | null;
  proofType: string;
  isActive: boolean;
}

/** Progresso em um eixo específico de atividades. */
export interface AxisProgress {
  axis: Axis;
  approvedHours: number;
  pendingHours: number;
  percent: number;
}

/** Progresso geral do estudante com segmentação por eixos. */
export interface StudentProgress {
  totalApprovedHours: number;
  totalPendingHours: number;
  totalRequiredHours: number;
  percent: number;
  remainingHours: number;
  axes: Record<Axis, AxisProgress>;
}

/** Resultado do cálculo detalhado de horas para um certificado. */
export interface HoursCalculationResult {
  declaredHours: number;
  recognizedHours: number;
  excessHours: number;
  isBelowMin: boolean;
  minHours: number;
  isAboveMaxPerCert: boolean;
  maxHoursPerCert: number;
  activityApprovedHours: number;
  activityPendingHours: number;
  activityRemainingHours: number | null;
  axisApprovedHours: number;
  axisPendingHours: number;
  axisRemainingHours: number | null;
  isBlockedByQuota: boolean;
  quotaWarning?: string;
}

export interface CertificateFilterState {
  axis: Axis | 'all';
  activityTypeId: string | 'all';
  status: CertificateStatus | 'all';
  query: string;
}
