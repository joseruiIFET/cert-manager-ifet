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

/** Traduz erro de Postgrest/Storage/Auth/rede para uma mensagem limpa e humanizada. */
export function toAppError(
  err: unknown,
  fallback = 'Não foi possível concluir a ação no momento. Por favor, tente novamente em instantes.'
): AppError {
  if (err instanceof AppError) return err;

  // Em desenvolvimento, mostra o erro técnico no terminal/console para depuração.
  // A tela continua recebendo só a mensagem amigável.
  if (process.env.NODE_ENV !== 'production' && err) {
    console.error('[toAppError]', err);
  }

  const e = (err ?? {}) as InfraError;
  const message = (e.message ?? '').toLowerCase();

  if (message.includes('failed to fetch') || message.includes('network')) {
    return new AppError('Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.');
  }
  if (message.includes('invalid login credentials')) {
    return new AppError('E-mail ou senha incorretos. Por favor, verifique suas credenciais.');
  }
  if (message.includes('email not confirmed')) {
    return new AppError('Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.');
  }
  if (message.includes('jwt') || message.includes('not authenticated')) {
    return new AppError('Sua sessão expirou por segurança. Faça login novamente para continuar.');
  }
  // Regras de negócio do banco (ex.: cota acumulada esgotada) já vêm em português,
  // escritas para o usuário em `raise exception` (supabase/migrations).
  if (e.code === 'P0001' && e.message) {
    return new AppError(e.message);
  }
  if (message.includes('row-level security') || e.code === '42501') {
    return new AppError('Você não possui permissão para realizar esta ação.');
  }
  if (e.code === '23503') {
    return new AppError('Este item não pode ser excluído pois está vinculado a outros registros. Tente inativá-lo.');
  }
  if (e.code === '23505') {
    return new AppError('Já existe um registro cadastrado com essas informações.');
  }
  if (message.includes('payload too large') || e.statusCode === '413') {
    return new AppError('O arquivo enviado é maior que o limite de 5 MB. Escolha um arquivo menor.');
  }
  if (message.includes('bucket not found') || message.includes('object not found') || message.includes('not found')) {
    return new AppError('O registro ou arquivo solicitado não foi encontrado.');
  }
  return new AppError(fallback);
}

/** Texto seguro e amigável para exibir em Toasts e alertas. */
export function mensagemDeErro(
  err: unknown,
  fallback = 'Não foi possível concluir a ação no momento. Por favor, tente novamente em instantes.'
): string {
  return toAppError(err, fallback).message;
}
