# Banco — como aplicar as migrations sem o Supabase CLI

Cada arquivo é colado inteiro no **Supabase → SQL Editor → Run**, um por vez, **nesta ordem**.
Todos rodam dentro de `begin … commit`: se der erro, nada é aplicado.

| Ordem | Arquivo | O que faz | Rodar em produção? |
|---|---|---|---|
| 0 | `scripts/00_diagnostico.sql` | Retrato da estrutura (só leitura) | Sim, quando quiser conferir |
| 1 | `scripts/01_checagem_antes.sql` | Confere se os dados passam nas novas regras (só leitura) | Sim, antes de tudo |
| 2 | `scripts/02_backup.sql` | Cópia dos dados (tem dados pessoais: salvar fora do git) | Sim |
| — | `migrations/20261013000000_baseline.sql` | Retrato do banco original | **Não** (já existe). Só em banco novo |
| 3 | `migrations/20261108000000_categories_progress_hours.sql` | Colunas novas, horas calculadas no banco | Sim |
| 4 | `migrations/20261124000000_seguranca_rls.sql` | Corrige as policies e permissões | Sim |
| 5 | `migrations/20261124010000_storage_privado.sql` | Bucket privado e policies de arquivos | Sim |

Para desfazer: `scripts/rollback/` (ordem inversa: storage → rls → 20261108).

## Testes de segurança

`tests/testes_seguranca.sql` cria usuários fictícios e tenta 35 ataques.
**Nunca rode em produção.** Rode num banco de teste montado assim:
`tests/supabase_mock.sql` (só fora do Supabase) → `baseline` → migrations em ordem → testes.

Resultado registrado em 2026-11-24 (Postgres 16 local imitando o Supabase):
antes das correções, 19 de 34 testes falhavam; depois, 34 de 34 passam e o T35
(cota esgotada) é recusado como esperado.
