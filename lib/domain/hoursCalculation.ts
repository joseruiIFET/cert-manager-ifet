import {
  AXES,
  TOTAL_REQUIRED_HOURS,
  type ActivityType,
  type Axis,
  type Certificate,
  type CertificateFilterState,
  type HoursCalculationResult,
  type StudentProgress,
} from '../types';

/**
 * Obtém a regra aplicável a um certificado, priorizando o ID da chave estrangeira
 * e caindo para a descrição textual da categoria se for registro legado.
 */
export function findRuleForCertificate(
  cert: Pick<Certificate, 'activityTypeId' | 'category'>,
  rules: ActivityType[]
): ActivityType | undefined {
  if (cert.activityTypeId) {
    const foundById = rules.find((r) => r.id === cert.activityTypeId);
    if (foundById) return foundById;
  }
  return rules.find((r) => r.description.trim().toLowerCase() === cert.category.trim().toLowerCase());
}

/**
 * Retorna as horas efetivamente reconhecidas de um certificado.
 * Se `recognizedHours` estiver preenchido, usa seu valor; caso contrário, usa `hours`.
 */
export function getEffectiveHours(cert: Pick<Certificate, 'hours' | 'recognizedHours'>): number {
  if (typeof cert.recognizedHours === 'number' && cert.recognizedHours >= 0) {
    return cert.recognizedHours;
  }
  return cert.hours;
}

interface CalculateHoursParams {
  declaredHours: number;
  rule: ActivityType;
  studentCertificates: Certificate[];
  axisMaxHours?: number | null;
  currentCertId?: string | null;
}

/**
 * Calcula com rigor as horas reconhecíveis, excedentes, reservas e saldos disponíveis
 * para um certificado, garantindo que nenhum limite estabelecido no PPC seja ultrapassado.
 */
export function calculateHoursForCertificate({
  declaredHours,
  rule,
  studentCertificates,
  axisMaxHours = null,
  currentCertId = null,
}: CalculateHoursParams): HoursCalculationResult {
  const safeDeclared = Math.max(0, Math.floor(declaredHours || 0));
  const otherCerts = studentCertificates.filter((c) => c.id !== currentCertId);

  // 1. Horas aprovadas e pendentes na atividade
  const sameActivityCerts = otherCerts.filter((c) => {
    if (c.activityTypeId && c.activityTypeId === rule.id) return true;
    return c.category.trim().toLowerCase() === rule.description.trim().toLowerCase();
  });

  const activityApprovedHours = sameActivityCerts
    .filter((c) => c.status === 'approved')
    .reduce((sum, c) => sum + getEffectiveHours(c), 0);

  const activityPendingHours = sameActivityCerts
    .filter((c) => c.status === 'pending')
    .reduce((sum, c) => sum + getEffectiveHours(c), 0);

  // 2. Horas aprovadas e pendentes no eixo
  const sameAxisCerts = otherCerts.filter((c) => {
    const r = findRuleForCertificate(c, [rule]);
    return r ? r.axis === rule.axis : false;
  });

  const axisApprovedHours = sameAxisCerts
    .filter((c) => c.status === 'approved')
    .reduce((sum, c) => sum + getEffectiveHours(c), 0);

  const axisPendingHours = sameAxisCerts
    .filter((c) => c.status === 'pending')
    .reduce((sum, c) => sum + getEffectiveHours(c), 0);

  // 3. Saldos disponíveis considerando limites acumulados (quando existirem no PPC)
  let activityRemainingHours: number | null = null;
  if (typeof rule.maxAccumulatedHours === 'number' && rule.maxAccumulatedHours > 0) {
    const used = activityApprovedHours + activityPendingHours;
    activityRemainingHours = Math.max(0, rule.maxAccumulatedHours - used);
  }

  let axisRemainingHours: number | null = null;
  if (typeof axisMaxHours === 'number' && axisMaxHours > 0) {
    const usedAxis = axisApprovedHours + axisPendingHours;
    axisRemainingHours = Math.max(0, axisMaxHours - usedAxis);
  }

  // 4. Verificação de quota esgotada
  const isBlockedByActivityQuota = activityRemainingHours !== null && activityRemainingHours <= 0;
  const isBlockedByAxisQuota = axisRemainingHours !== null && axisRemainingHours <= 0;
  const isBlockedByQuota = isBlockedByActivityQuota || isBlockedByAxisQuota;

  let quotaWarning: string | undefined;
  if (isBlockedByActivityQuota) {
    quotaWarning = `O limite acumulado desta atividade (${rule.maxAccumulatedHours} h) já foi totalmente atingido ou reservado por outros envios.`;
  } else if (isBlockedByAxisQuota) {
    quotaWarning = `O limite acumulado do eixo ${rule.axis} (${axisMaxHours} h) já foi totalmente atingido ou reservado por outros envios.`;
  }

  // 5. Menor dos limites aplicáveis
  // O mínimo por certificado (minHours) NÃO bloqueia e não reduz as horas reconhecíveis.
  // Horas reconhecíveis = min(declaradas, teto individual, saldo da atividade, saldo do eixo)
  let recognized = Math.min(safeDeclared, rule.maxHours);

  if (activityRemainingHours !== null) {
    recognized = Math.min(recognized, activityRemainingHours);
  }
  if (axisRemainingHours !== null) {
    recognized = Math.min(recognized, axisRemainingHours);
  }

  recognized = Math.max(0, recognized);
  const excessHours = Math.max(0, safeDeclared - recognized);
  const isBelowMin = safeDeclared > 0 && safeDeclared < rule.minHours;
  const isAboveMaxPerCert = safeDeclared > rule.maxHours;

  return {
    declaredHours: safeDeclared,
    recognizedHours: recognized,
    excessHours,
    isBelowMin,
    minHours: rule.minHours,
    isAboveMaxPerCert,
    maxHoursPerCert: rule.maxHours,
    activityApprovedHours,
    activityPendingHours,
    activityRemainingHours,
    axisApprovedHours,
    axisPendingHours,
    axisRemainingHours,
    isBlockedByQuota,
    quotaWarning,
  };
}

/**
 * Calcula o progresso completo do estudante com total geral e divisão proporcional por eixos.
 * Apenas certificados aprovados entram nas horas cumpridas e na barra.
 */
export function calculateStudentProgress(
  certificates: Certificate[],
  rules: ActivityType[],
  totalRequiredHours = TOTAL_REQUIRED_HOURS
): StudentProgress {
  const safeTotalRequired = Math.max(1, totalRequiredHours || TOTAL_REQUIRED_HOURS);

  const axesAccumulator: Record<Axis, { approvedHours: number; pendingHours: number }> = {
    Tecnológico: { approvedHours: 0, pendingHours: 0 },
    Integrador: { approvedHours: 0, pendingHours: 0 },
    Básico: { approvedHours: 0, pendingHours: 0 },
  };

  let totalApprovedHours = 0;
  let totalPendingHours = 0;

  for (const cert of certificates) {
    const rule = findRuleForCertificate(cert, rules);
    const axis: Axis = rule?.axis ?? 'Tecnológico';
    const effectiveHours = getEffectiveHours(cert);

    /* Proteção defensiva: se o eixo vindo do banco não estiver entre os
       inicializados (ex.: valor customizado ou acentuação divergente), cria
       a entrada no acumulador em vez de lançar TypeError. */
    if (!axesAccumulator[axis]) {
      axesAccumulator[axis] = { approvedHours: 0, pendingHours: 0 };
    }

    if (cert.status === 'approved') {
      axesAccumulator[axis].approvedHours += effectiveHours;
      totalApprovedHours += effectiveHours;
    } else if (cert.status === 'pending') {
      axesAccumulator[axis].pendingHours += effectiveHours;
      totalPendingHours += effectiveHours;
    }
  }

  const percent = Math.min(100, Math.round((totalApprovedHours / safeTotalRequired) * 100));
  const remainingHours = Math.max(0, safeTotalRequired - totalApprovedHours);

  const axesResult = AXES.reduce<Record<Axis, { axis: Axis; approvedHours: number; pendingHours: number; percent: number }>>(
    (acc, axis) => {
      const data = axesAccumulator[axis];
      const axisPercent = Math.min(100, Math.round((data.approvedHours / safeTotalRequired) * 100));
      acc[axis] = {
        axis,
        approvedHours: data.approvedHours,
        pendingHours: data.pendingHours,
        percent: axisPercent,
      };
      return acc;
    },
    {} as Record<Axis, { axis: Axis; approvedHours: number; pendingHours: number; percent: number }>
  );

  return {
    totalApprovedHours,
    totalPendingHours,
    totalRequiredHours: safeTotalRequired,
    percent,
    remainingHours,
    axes: axesResult,
  };
}

/**
 * Filtra a lista de certificados combinando múltiplos critérios simultâneos:
 * - Eixo (Tecnológico, Integrador, Básico, Todos)
 * - Tipo de atividade específico
 * - Situação (em análise, aprovado, rejeitado, todos)
 * - Busca textual por título do certificado ou nome da atividade
 */
export function filterCertificates(
  certificates: Certificate[],
  rules: ActivityType[],
  filters: Partial<CertificateFilterState>
): Certificate[] {
  const { axis = 'all', activityTypeId = 'all', status = 'all', query = '' } = filters;
  const cleanQuery = query.trim().toLowerCase();

  return certificates.filter((cert) => {
    const rule = findRuleForCertificate(cert, rules);

    // 1. Filtro por Eixo
    if (axis !== 'all') {
      const certAxis = rule?.axis;
      if (certAxis !== axis) return false;
    }

    // 2. Filtro por Tipo de Atividade
    if (activityTypeId !== 'all') {
      const matchesId = cert.activityTypeId === activityTypeId;
      const matchesRuleId = rule?.id === activityTypeId;
      if (!matchesId && !matchesRuleId) return false;
    }

    // 3. Filtro por Situação
    if (status !== 'all' && cert.status !== status) {
      return false;
    }

    // 4. Busca Textual por título do certificado ou nome da atividade
    if (cleanQuery) {
      const titleMatch = cert.title.toLowerCase().includes(cleanQuery);
      const categoryMatch = cert.category.toLowerCase().includes(cleanQuery);
      const ruleDescMatch = rule ? rule.description.toLowerCase().includes(cleanQuery) : false;
      if (!titleMatch && !categoryMatch && !ruleDescMatch) {
        return false;
      }
    }

    return true;
  });
}
