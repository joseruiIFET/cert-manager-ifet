import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, toAppError } from '@/lib/errors';

const BUCKET = 'documents';
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg'];

/**
 * Domínio de arquivos (arch.md §5): upload e acesso moram aqui, separados do CRUD.
 *
 * `fileRef` guarda o CAMINHO no bucket. Registros legados guardam a URL pública inteira;
 * `extractPath` aceita os dois, o que deixa o bucket pronto para virar privado.
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
    throw new AppError('Envie um arquivo PDF, PNG ou JPG.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new AppError('O arquivo deve ter no máximo 5 MB.');
  }
}

export function createStorageService(db: SupabaseClient) {
  return {
    /** Envia o arquivo e devolve o caminho a gravar em `certificates.file_url`. */
    async upload(userId: string, file: File): Promise<string> {
      validateFile(file);
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await db.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
      });
      if (error) throw toAppError(error, 'Não foi possível enviar o arquivo.');
      return path;
    },

    /** URL temporária (1 h) para abrir o arquivo — funciona com bucket público ou privado. */
    async getAccessUrl(fileRef: string): Promise<string> {
      const path = extractPath(fileRef);
      const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
      if (!error && data) return data.signedUrl;
      // Bucket ainda público (ou sem policy de SELECT para assinar): a URL pública funciona.
      // Quando o bucket virar privado, este fallback deixa de servir e pode ser removido.
      return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    },
  };
}

export type StorageService = ReturnType<typeof createStorageService>;
