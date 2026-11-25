import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, toAppError } from '@/lib/errors';

const BUCKET = 'documents';
/** Validade do link do comprovante: curta, porque o arquivo tem dados pessoais. */
const SIGNED_URL_SECONDS = 10 * 60;
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg'];
const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

/**
 * Domínio de arquivos (arch.md §5): upload e acesso moram aqui, separados do CRUD.
 *
 * `fileRef` guarda o CAMINHO no bucket. Registros legados guardam a URL pública inteira;
 * `extractPath` aceita os dois e devolve só o caminho.
 */
function extractPath(fileRef: string): string {
  const marker = `/${BUCKET}/`;
  const idx = fileRef.indexOf(marker);
  return fileRef.startsWith('http') && idx !== -1
    ? decodeURIComponent(fileRef.slice(idx + marker.length).split('?')[0])
    : fileRef;
}

export function validateFile(file: File): void {
  if (!ALLOWED_MIME.includes(file.type)) {
    throw new AppError('Formato de arquivo inválido. Por favor, envie um documento PDF ou imagem PNG/JPG.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new AppError('O tamanho do arquivo excede o limite permitido de 5 MB.');
  }
}

export function createStorageService(db: SupabaseClient) {
  return {
    /** Envia o arquivo e devolve o caminho a gravar em `certificates.file_url`. */
    async upload(userId: string, file: File): Promise<string> {
      validateFile(file);
      // Extensão derivada do tipo validado, não do nome que o usuário deu ao arquivo.
      const ext = EXT_BY_MIME[file.type];
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await db.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
      });
      if (error) throw toAppError(error, 'Não foi possível realizar o envio do anexo. Verifique o arquivo e tente novamente.');
      return path;
    },

    /**
     * URL assinada e temporária para abrir o arquivo. O bucket é privado
     * (migration 20261124010000_storage_privado): só o dono e a coordenação conseguem gerar.
     */
    async getAccessUrl(fileRef: string): Promise<string> {
      const path = extractPath(fileRef);
      const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
      if (error || !data) {
        throw toAppError(error, 'Não foi possível abrir o arquivo anexado. Por favor, tente novamente em instantes.');
      }
      return data.signedUrl;
    },
  };
}

export type StorageService = ReturnType<typeof createStorageService>;
