import test from 'node:test';
import assert from 'node:assert/strict';

// Importando as funções puras de domínio
import {
  calculateHoursForCertificate,
  calculateStudentProgress,
  filterCertificates,
} from '../lib/domain/hoursCalculation.ts';

// Massa de dados de teste (Regras)
const ruleCurso = {
  id: 'rule-1',
  courseId: 'course-1',
  axis: 'Tecnológico',
  description: 'Curso de curta duração',
  minHours: 5,
  maxHours: 20,
  maxAccumulatedHours: 40,
  proofType: 'Certificado de conclusão com carga horária',
  isActive: true,
};

const rulePalestra = {
  id: 'rule-2',
  courseId: 'course-1',
  axis: 'Integrador',
  description: 'Palestra ou Seminário',
  minHours: 2,
  maxHours: 10,
  maxAccumulatedHours: 30,
  proofType: 'Certificado de participação',
  isActive: true,
};

const ruleIniciacao = {
  id: 'rule-3',
  courseId: 'course-1',
  axis: 'Básico',
  description: 'Projeto de Iniciação Científica',
  minHours: 10,
  maxHours: 60,
  maxAccumulatedHours: null, // Sem limite acumulado no PPC
  proofType: 'Declaração do orientador',
  isActive: true,
};

const allRules = [ruleCurso, rulePalestra, ruleIniciacao];

// ============================================================================
// 1. TESTES DE MÍNIMO E MÁXIMO DE HORAS
// ============================================================================

test('Mínimo de horas: permite envio abaixo do mínimo, sinaliza aviso e não infla horas reconhecidas', () => {
  const result = calculateHoursForCertificate({
    declaredHours: 3, // Mínimo é 5h
    rule: ruleCurso,
    studentCertificates: [],
  });

  assert.equal(result.isBelowMin, true);
  assert.equal(result.declaredHours, 3);
  assert.equal(result.recognizedHours, 3);
  assert.equal(result.excessHours, 0);
  assert.equal(result.isBlockedByQuota, false);
});

test('Horas dentro dos limites: calcula exatamente as horas declaradas', () => {
  const result = calculateHoursForCertificate({
    declaredHours: 15, // Mínimo 5h, máximo 20h
    rule: ruleCurso,
    studentCertificates: [],
  });

  assert.equal(result.isBelowMin, false);
  assert.equal(result.isAboveMaxPerCert, false);
  assert.equal(result.declaredHours, 15);
  assert.equal(result.recognizedHours, 15);
  assert.equal(result.excessHours, 0);
});

test('Máximo individual por certificado: limita horas reconhecíveis e calcula excedente a desconsiderar', () => {
  const result = calculateHoursForCertificate({
    declaredHours: 25, // Máximo por cert é 20h
    rule: ruleCurso,
    studentCertificates: [],
  });

  assert.equal(result.isAboveMaxPerCert, true);
  assert.equal(result.declaredHours, 25);
  assert.equal(result.recognizedHours, 20); // Limitado a 20h
  assert.equal(result.excessHours, 5);      // 5h excedentes
  assert.equal(result.isBlockedByQuota, false);
});

// ============================================================================
// 2. TESTES DE LIMITES ACUMULADOS E RESERVAS
// ============================================================================

test('Limites acumulados: respeita teto acumulado considerando aprovados e pendentes (reservas)', () => {
  const existingCerts = [
    {
      id: 'c1',
      studentId: 's1',
      activityTypeId: ruleCurso.id,
      title: 'Curso 1',
      category: ruleCurso.description,
      hours: 20,
      recognizedHours: 20,
      fileRef: null,
      status: 'approved',
      feedback: null,
      createdAt: '2026-10-01',
    },
    {
      id: 'c2',
      studentId: 's1',
      activityTypeId: ruleCurso.id,
      title: 'Curso 2 pendente',
      category: ruleCurso.description,
      hours: 15,
      recognizedHours: 15,
      fileRef: null,
      status: 'pending',
      feedback: null,
      createdAt: '2026-10-05',
    },
  ];

  // Limite acumulado é 40h. 20h aprovadas + 15h reservadas = 35h consumidas. Saldo = 5h.
  const result = calculateHoursForCertificate({
    declaredHours: 10,
    rule: ruleCurso,
    studentCertificates: existingCerts,
  });

  assert.equal(result.activityApprovedHours, 20);
  assert.equal(result.activityPendingHours, 15);
  assert.equal(result.activityRemainingHours, 5);
  assert.equal(result.declaredHours, 10);
  assert.equal(result.recognizedHours, 5); // Limitado ao saldo restante de 5h
  assert.equal(result.excessHours, 5);     // 5h excedentes além da quota
  assert.equal(result.isBlockedByQuota, false);
});

test('Limites acumulados: bloqueia quando a quota da atividade estiver 100% esgotada', () => {
  const existingCerts = [
    {
      id: 'c1',
      studentId: 's1',
      activityTypeId: ruleCurso.id,
      title: 'Curso 1',
      category: ruleCurso.description,
      hours: 20,
      recognizedHours: 20,
      fileRef: null,
      status: 'approved',
      feedback: null,
      createdAt: '2026-10-01',
    },
    {
      id: 'c2',
      studentId: 's1',
      activityTypeId: ruleCurso.id,
      title: 'Curso 2',
      category: ruleCurso.description,
      hours: 20,
      recognizedHours: 20,
      fileRef: null,
      status: 'approved',
      feedback: null,
      createdAt: '2026-10-02',
    },
  ];

  // Total 40h de 40h esgotado
  const result = calculateHoursForCertificate({
    declaredHours: 10,
    rule: ruleCurso,
    studentCertificates: existingCerts,
  });

  assert.equal(result.activityRemainingHours, 0);
  assert.equal(result.isBlockedByQuota, true);
  assert.equal(result.recognizedHours, 0);
  assert.ok(result.quotaWarning?.includes('totalmente atingido'));
});

test('Limites acumulados: libera reserva quando o certificado for rejeitado', () => {
  const certsWithRejected = [
    {
      id: 'c1',
      studentId: 's1',
      activityTypeId: ruleCurso.id,
      title: 'Curso Rejeitado',
      category: ruleCurso.description,
      hours: 20,
      recognizedHours: 20,
      fileRef: null,
      status: 'rejected', // Rejeitado não consome reserva!
      feedback: 'Comprovante ilegível',
      createdAt: '2026-10-01',
    },
  ];

  const result = calculateHoursForCertificate({
    declaredHours: 20,
    rule: ruleCurso,
    studentCertificates: certsWithRejected,
  });

  assert.equal(result.activityApprovedHours, 0);
  assert.equal(result.activityPendingHours, 0);
  assert.equal(result.activityRemainingHours, 40);
  assert.equal(result.recognizedHours, 20);
});

test('Reenvio: não duplica a reserva do próprio certificado em edição', () => {
  const certBeingEdited = {
    id: 'c-editing',
    studentId: 's1',
    activityTypeId: ruleCurso.id,
    title: 'Meu curso',
    category: ruleCurso.description,
    hours: 15,
    recognizedHours: 15,
    fileRef: null,
    status: 'pending',
    feedback: null,
    createdAt: '2026-10-01',
  };

  // Ao recalcular para o mesmo id, o cert sendo editado é excluído do cálculo prévio
  const result = calculateHoursForCertificate({
    declaredHours: 18,
    rule: ruleCurso,
    studentCertificates: [certBeingEdited],
    currentCertId: 'c-editing',
  });

  assert.equal(result.activityApprovedHours, 0);
  assert.equal(result.activityPendingHours, 0);
  assert.equal(result.activityRemainingHours, 40);
  assert.equal(result.recognizedHours, 18);
});

// ============================================================================
// 3. TESTES DE PROGRESSO SEGMENTADO
// ============================================================================

test('Progresso: soma horas aprovadas por eixo e calcula percentual correto, excluindo pendentes e rejeitados da barra', () => {
  const certs = [
    {
      id: '1',
      studentId: 's1',
      activityTypeId: ruleCurso.id,
      title: 'Curso 1',
      category: ruleCurso.description,
      hours: 20,
      recognizedHours: 20,
      fileRef: null,
      status: 'approved',
      feedback: null,
      createdAt: '2026-10-01',
    },
    {
      id: '2',
      studentId: 's1',
      activityTypeId: rulePalestra.id,
      title: 'Palestra 1',
      category: rulePalestra.description,
      hours: 10,
      recognizedHours: 10,
      fileRef: null,
      status: 'approved',
      feedback: null,
      createdAt: '2026-10-02',
    },
    {
      id: '3',
      studentId: 's1',
      activityTypeId: ruleIniciacao.id,
      title: 'Iniciação Pendente',
      category: ruleIniciacao.description,
      hours: 30,
      recognizedHours: 30,
      fileRef: null,
      status: 'pending', // Não entra na barra de aprovadas!
      feedback: null,
      createdAt: '2026-10-03',
    },
    {
      id: '4',
      studentId: 's1',
      activityTypeId: ruleIniciacao.id,
      title: 'Iniciação Rejeitada',
      category: ruleIniciacao.description,
      hours: 15,
      recognizedHours: 0,
      fileRef: null,
      status: 'rejected', // Não entra na barra nem em pendentes!
      feedback: 'Falta assinatura',
      createdAt: '2026-10-04',
    },
  ];

  const progress = calculateStudentProgress(certs, allRules, 120);

  // Total aprovado: 20 + 10 = 30h de 120h (25%)
  assert.equal(progress.totalApprovedHours, 30);
  assert.equal(progress.totalPendingHours, 30);
  assert.equal(progress.remainingHours, 90);
  assert.equal(progress.percent, 25);

  // Eixos individuais
  assert.equal(progress.axes.Tecnológico.approvedHours, 20);
  assert.equal(progress.axes.Integrador.approvedHours, 10);
  assert.equal(progress.axes.Básico.approvedHours, 0);
  assert.equal(progress.axes.Básico.pendingHours, 30);
});

// ============================================================================
// 4. TESTES DE FILTROS SIMULTÂNEOS
// ============================================================================

test('Filtros: filtra por eixo', () => {
  const certs = [
    { id: '1', title: 'React JS', category: ruleCurso.description, activityTypeId: ruleCurso.id, status: 'approved', hours: 20 },
    { id: '2', title: 'Palestra IA', category: rulePalestra.description, activityTypeId: rulePalestra.id, status: 'pending', hours: 5 },
  ];

  const tec = filterCertificates(certs, allRules, { axis: 'Tecnológico' });
  assert.equal(tec.length, 1);
  assert.equal(tec[0].title, 'React JS');

  const int = filterCertificates(certs, allRules, { axis: 'Integrador' });
  assert.equal(int.length, 1);
  assert.equal(int[0].title, 'Palestra IA');
});

test('Filtros: combina categoria, situação e termo de busca', () => {
  const certs = [
    { id: '1', title: 'Desenvolvimento Web', category: ruleCurso.description, activityTypeId: ruleCurso.id, status: 'approved', hours: 20 },
    { id: '2', title: 'Desenvolvimento Mobile', category: ruleCurso.description, activityTypeId: ruleCurso.id, status: 'pending', hours: 10 },
    { id: '3', title: 'Palestra de Inovação', category: rulePalestra.description, activityTypeId: rulePalestra.id, status: 'approved', hours: 4 },
  ];

  // Busca por 'desenvolvimento', status 'approved' e tipo de atividade do curso
  const filtered = filterCertificates(certs, allRules, {
    activityTypeId: ruleCurso.id,
    status: 'approved',
    query: 'web',
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, 'Desenvolvimento Web');
});

test('Filtros: limpar filtros retorna lista completa', () => {
  const certs = [
    { id: '1', title: 'Cert A', category: ruleCurso.description, activityTypeId: ruleCurso.id, status: 'approved', hours: 20 },
    { id: '2', title: 'Cert B', category: rulePalestra.description, activityTypeId: rulePalestra.id, status: 'rejected', hours: 5 },
  ];

  const all = filterCertificates(certs, allRules, { axis: 'all', activityTypeId: 'all', status: 'all', query: '' });
  assert.equal(all.length, 2);
});
