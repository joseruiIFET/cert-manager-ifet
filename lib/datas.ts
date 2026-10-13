/** Datas em pt-BR, sempre no fuso de São Paulo (design.md §9). Helper único. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
