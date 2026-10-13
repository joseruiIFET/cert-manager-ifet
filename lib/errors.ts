/**
 * Blindagem de erros (arch.md §6): erros de infraestrutura nunca chegam à UI.
 * Os serviços capturam o erro do SDK e lançam um AppError com texto em português.
 */

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

interface InfraError {
  message?: string;
  code?: string;
  status?: number;
  statusCode?: string | number;
}

/** Traduz erro de Postgrest/Storage/Auth/rede para uma mensagem limpa. */
export function toAppError(err: unknown, fallback = 'Não foi possível concluir a operação.'): AppError {
  if (err instanceof AppError) return err;

  const e = (err ?? {}) as InfraError;
  const message = (e.message ?? '').toLowerCase();

  if (message.includes('failed to fetch') || message.includes('network')) {
    return new AppError('Erro de conexão com o servidor. Verifique sua internet.');
  }
  if (message.includes('invalid login credentials')) {
    return new AppError('E-mail ou senha incorretos.');
  }
  if (message.includes('email not confirmed')) {
    return new AppError('Confirme seu e-mail antes de entrar.');
  }
  if (message.includes('jwt') || message.includes('not authenticated')) {
    return new AppError('Sua sessão expirou. Entre novamente.');
  }
  if (message.includes('row-level security') || e.code === '42501') {
    return new AppError('Você não tem permissão para realizar esta ação.');
  }
  if (e.code === '23503') {
    return new AppError('Este registro está vinculado a outros dados e não pode ser removido. Tente inativá-lo.');
  }
  if (e.code === '23505') {
    return new AppError('Já existe um registro com esses dados.');
  }
  if (message.includes('payload too large') || e.statusCode === '413') {
    return new AppError('O arquivo é maior que o permitido.');
  }
  return new AppError(fallback);
}

/** Texto seguro para exibir (Toast). */
export function mensagemDeErro(err: unknown, fallback?: string): string {
  return toAppError(err, fallback).message;
}
