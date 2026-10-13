# Cert Manager IFET — Prompt de Contexto do Projeto

> Documento raiz de contexto técnico do **cert-manager-ifet**. Descreve **o sistema como ele é
> hoje** (2026-10-13, após a refatoração da fase 2) e o que ainda falta para fechar a doutrina.
>
> **Regra de manutenção:** *os `spec/` são atualizados ao fim de cada tarefa.* Mudou código,
> banco, deploy ou decisão ⇒ este arquivo (e o `arch`/`performance`/`design`/`deploy`
> correspondente) é atualizado na mesma entrega.
>
> **Convenção de referência ao código: cite o símbolo, nunca a linha.**
> `CertificatesService.reject`, não `certificatesService.ts:112`.
>
> **Documentos-irmãos:** doutrina — `arch.md`, `performance.md`, `design.md`; operação —
> `deploy.md`; estado real — este arquivo; estrutura rápida — `README.md`.

---

## 1. O que é o sistema

Plataforma web para **gestão de certificados de atividades complementares** de alunos de um
Instituto Federal (IFET). O aluno envia certificados (PDF/PNG/JPG) e acumula horas; a coordenação
analisa, aprova ou rejeita (com motivo obrigatório) e acompanha o progresso de cada aluno rumo à
carga de **120 horas** (`TOTAL_REQUIRED_HOURS`, fixa por ora).

```
COORDENADOR (profiles.role = 'coordinator')
   cadastra CURSOS e REGRAS (eixo, mín/teto de horas, comprovante exigido)
   analisa PENDENTES → APROVA ou REJEITA (motivo obrigatório)
                                   ▲                         │ rejeitado: volta ao aluno
                                   │ pending                 ▼
ALUNO (qualquer outro role)  ──▶ CERTIFICADO ──▶ (approved | rejected)
   escolhe o tipo, informa título/horas, anexa arquivo; corrige rejeitados (volta a pending)
```

Estados de `certificates.status`: `pending` → `approved` | `rejected`; `rejected` → (aluno
corrige) → `pending`. Certificado aprovado é somente leitura na UI.

---

## 2. Mapa do repositório

| Caminho | Papel |
|---|---|
| `app/layout.tsx` | Layout raiz: `next/font` (DM Sans), `ToastProvider`, `lang="pt-BR"` |
| `app/page.tsx` | Redireciona por papel (Server Component) |
| `app/login/` | Login (client) |
| `app/dashboard/student/` | `layout.tsx` (shell), `page.tsx` (server), `_components/StudentCertificates` + `CertificateFormModal` |
| `app/dashboard/coordinator/` | `layout.tsx`, `page.tsx` (server), `_components/ReviewWorkspace` |
| `app/dashboard/coordinator/activities/` | `page.tsx` (server), `_components/ActivitiesManager` |
| `proxy.ts` | Gate de sessão e papel (Next 16; substitui `middleware.ts`) e renovação do cookie |
| `components/` | `DashboardShell`, `Modal`, `ConfirmDialog`, `Toast`, `StatusBadge`, `ProgressBar`, `CertificateCard`, `FileLink`, `Feedback` (Skeleton/EmptyState), `Icones` |
| `lib/services/` | **Único** lugar que usa o cliente Supabase: `authService`, `profilesService`, `certificatesService`, `activityTypesService` (+ cursos), `storageService`; `useServices` (hook client) |
| `lib/supabase/` | `client.ts` (browser) e `server.ts` (RSC/Actions) via `@supabase/ssr` |
| `lib/types.ts` · `errors.ts` · `datas.ts` · `session.ts` | DTOs · `AppError` e tradução · datas pt-BR/São Paulo · `requireProfile()` |
| `supabase/proposals/` | SQL **proposto, não aplicado** |
| `spec/` | Doutrina e contexto |

---

## 3. Como rodar

```bash
cp .env.example .env.local   # NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY
npm install
npm run dev                  # :3000
npm run lint && npx tsc --noEmit && npm run build
```
Não há testes automatizados nem CI.

---

## 4. Stack

Next.js **16.0.8** (App Router, `proxy.ts`) · React **19.2.1** · TypeScript 5 (`strict`) ·
`@supabase/supabase-js` ^2.87 · **`@supabase/ssr`** · ESLint 9. **Sem** Tailwind (removido),
SWR, zod, lib de ícones nem de toast (componentes próprios). CSS Modules + tokens no `:root`.

---

## 5. Modelo de dados (inferido do código — **sem schema versionado**)

| Tabela | Colunas usadas | Notas |
|---|---|---|
| `profiles` | `id` (= `auth.users.id`), `full_name`, `email`, `role` | `role = 'coordinator'` → coordenação; qualquer outro → aluno |
| `courses` | `id`, `name` | |
| `activity_types` | `id`, `course_id`, `eixo`, `description`, `min_hours`, `max_hours`, `proof_type`, `is_active` | Regras oficiais |
| `certificates` | `id`, `student_id`, `title`, `category`, `hours`, `file_url`, `status`, `feedback`, `created_at` | `category` = texto de `activity_types.description` (vínculo frágil, sem FK) |
| bucket `documents` | `{userId}/{timestamp}.{ext}` | Hoje **público**; `file_url` guarda **caminho** (novos) ou **URL pública** (legados) |

`feedback` é histórico de rejeições concatenado em texto (`[data] motivo\n----------------\n…`).

---

## 6. Fluxos implementados

- **Login** (`authService.signIn`): Auth → papel em `profiles` → destino por papel. Erros traduzidos
  (`E-mail ou senha incorretos.`). Sessão em **cookie** (`@supabase/ssr`).
- **Gate** (`proxy.ts`): sem sessão em `/dashboard/*` → `/login`; logado em `/login` → home do papel;
  aluno em rota de coordenação (e vice-versa) → home do próprio papel. É UX; a autorização real é RLS.
- **Aluno** (`StudentPage` server → `StudentCertificates`): lista dos próprios certificados e regras
  ativas vêm do servidor; filtro por status; modal de envio/correção com validação por campo,
  regra do tipo exibida, aviso (não bloqueio) de horas fora de mín/teto; reenvio volta a `pending`;
  após salvar, `router.refresh()`.
- **Coordenação** (`CoordinatorPage` server → `ReviewWorkspace`): resumo leve por aluno (agregado no
  cliente, **provisório**), certificados do aluno carregados sob demanda com cache por aluno;
  aprovar com `ConfirmDialog`; rejeitar com motivo obrigatório (`certificates.reject`);
  master–detail, vira duas telas em ≤968 px.
- **Atividades** (`ActivitiesManager`): curso (modal), CRUD de regras, exclusão com confirmação e
  atalho "inativar"; tabela vira cartões em ≤968 px.
- **Arquivos** (`storageService`): upload valida tipo (PDF/PNG/JPG) e 5 MB; `getAccessUrl` tenta
  URL assinada (1 h) e **cai para a URL pública** se não der (bucket público/sem policy de SELECT).

---

## 7. Segurança — estado

- ✅ Sem `supabase.from` na UI; erros de infra traduzidos; sessão em cookie; service role não usada.
- ✅ Validação de upload (tipo/tamanho) no cliente (`validateFile`).
- ⚠️ **RLS desconhecida e não versionada** — única barreira real contra um aluno aprovar o próprio
  certificado ou ler os de outros. **Levantar primeiro** (`supabase db pull`).
- ⚠️ Bucket `documents` público; validação de upload só no cliente (reforçar com limites/MIME do bucket).
- ⚠️ Criação/promoção de coordenador é manual no banco; sem `reviewed_by/at`.
- ⚠️ Sem rate limiting, CSP nem cabeçalhos em `next.config.ts`.

---

## 8. Auditoria contra a doutrina (pós-fase 2)

| Doc | Regra | Status |
|---|---|---|
| arch §1 | Adapter/DTO, UI agnóstica | ✅ `lib/services` + `lib/types` |
| arch §2 | Sessão em cookie HttpOnly; service role só servidor | ✅ cookie via `@supabase/ssr` (⚠️ cookies do `@supabase/ssr` não são HttpOnly por padrão no browser client — aceitável, mas documentado) |
| arch §2 | RLS versionada; bucket privado + URL assinada | ❌ RLS desconhecida; bucket público; URL assinada com fallback |
| arch §4 | FK `activity_type_id`; `reviewed_by/at`; enums/checks | ❌ proposto em `supabase/proposals/` |
| arch §5 | Validação na borda; upload em serviço próprio | ✅ (validação manual, sem zod — decisão a registrar) |
| arch §6 | Blindagem de erros | ✅ `toAppError` |
| arch §8 | Migrations via Supabase CLI | ❌ não iniciado (`supabase/migrations` não existe) |
| perf §1 | Server Component + ilhas; gate em proxy | ✅ |
| perf §2 | Cache/dedupe | 🟡 RSC + cache por aluno na coordenação; sem SWR |
| perf §3 | `order`+`limit`; agregar no banco | 🟡 `limit` nas listas do aluno; **fila da coordenação ainda sem paginação e somada no cliente** |
| perf §3 | Índices | ❌ propostos, não aplicados |
| perf §5/6 | Bundle enxuto, `next/font` | ✅ |
| perf §7 | Sem `alert/confirm/prompt`; skeletons | ✅ |
| design | Tokens, shell, componentes, SVG, a11y, responsivo | ✅ implementado; **não validado visualmente** |
| deploy | Alvo de hospedagem, CI, container | ❌ não definido |

---

## 9. Decisões registradas

- Migrations: **Supabase CLI, não Flyway** (`arch.md` §8, `deploy.md` §4).
- Paleta **verde-floresta** institucional (`design.md` §2); troca = só tokens.
- Validação **manual** (sem zod) — mantém zero dependência extra; revisitar se os formulários crescerem.
- `proxy.ts` (Next 16) no lugar de `middleware.ts`.
- Hospedagem: **pendente** (Vercel × servidor da escola).
- Fallback para URL pública em `getAccessUrl` é **transitório**: remover ao tornar o bucket privado.

---

## 10. Dívida técnica e pendências (por risco)

### 🔴 Risco vivo
1. **RLS não versionada/auditada** (ver §7). Testar como aluno: tentar `update` de `status` pelo console.
2. **Bucket público** com dados pessoais. Passo seguro: policy de SELECT em `storage.objects`
   (SQL na conversa de 2026-10-13) → validar URLs assinadas → `update storage.buckets set public=false`.
3. Sem trilha de decisão (`reviewed_by`, `reviewed_at`).

### 🟠 Antes de expor a mais gente
- Fila da coordenação sem paginação; resumo somado no cliente → view `student_review_summary`.
- `category` por nome em vez de FK.
- 120 h fixas; aprovar sem checar teto (`max_hours`).
- Validação de upload só no cliente.
- **Nada disto foi testado com sessão real e navegador** — rodar o fluxo completo.

### 🟡 Qualidade
- Sem testes, sem CI, sem Dockerfile/alvo de deploy; `.env.example` versionado e `.gitignore` ajustado para não ignorá-lo.
- Sem SWR/cache de cliente para leituras repetidas.
- Visual não conferido contra o `design.md` (contraste, mobile).

### Aplicado em 2026-10-13 (fase 2)
Serviços/DTO/erros; `proxy.ts` + cookies; Server Components com ilhas; shell, Modal, ConfirmDialog,
Toast, StatusBadge, ProgressBar, CertificateCard, FileLink; tokens e `next/font`; remoção de
Tailwind, template e `alert/confirm/prompt`; upload validado; URL assinada com fallback;
README e `.env.example`. `lint`, `tsc` e `build` passam.

---

## 11. Banco: alterações

- **Nenhuma alteração obrigatória** foi feita ou exigida: o código usa só o schema existente.
- **SQL opcional entregue (2026-10-13):** policy `documents_select_own_or_coordinator` em
  `storage.objects` (habilita URL assinada). Aplicada manualmente pelo usuário, se desejar —
  **registrar aqui quando for executada.**
- **Proposto, não aplicado:** `supabase/proposals/001_estrutura_proposta.sql` (índices,
  `reviewed_by/at`, `activity_type_id`, view, bucket privado, requisitos de RLS).

---

## 12. Convenções a respeitar ao editar

- Ler a doutrina antes: `arch.md` (serviço/tela), `performance.md` (query/tela), `design.md` (UI).
- UI **nunca** chama `supabase.*`; vai por `lib/services` e DTO de `lib/types.ts`.
- Server Component por padrão; `"use client"` só em ilhas interativas.
- Feedback por `useToast`; confirmação por `ConfirmDialog`; nada de `alert/confirm/prompt`.
- Cores só por token (`var(--…)`); sem emoji como ícone (`components/Icones`).
- Coluna/tabela nova ⇒ migration versionada na mesma entrega (quando o CLI existir) e DTO atualizado.
- Copy & paste: revisar tabela, colunas, textos. Comentários em português explicando o *porquê*.
- **Ao terminar qualquer tarefa, atualizar `spec/`** (este arquivo e o documento afetado).

---

## 13. Onde cavar mais fundo

| Preciso de... | Vou em... |
|---|---|
| Decisão de aprovar/rejeitar | `ReviewWorkspace` (`confirmDecision`, `applyDecision`) + `certificatesService.approve/reject` |
| Envio/correção do aluno | `CertificateFormModal` + `certificatesService.create/resubmit` + `storageService.upload` |
| Regras e cursos | `ActivitiesManager` + `activityTypesService` |
| Login e roteamento por papel | `app/login/page.tsx`, `proxy.ts`, `lib/session.ts` |
| Tradução de erros | `lib/errors.ts` |
| Abrir arquivo (assinada + fallback) | `storageService.getAccessUrl`, `components/FileLink` |
| Tokens e componentes globais | `app/globals.css` |
| SQL proposto | `supabase/proposals/001_estrutura_proposta.sql` |

---

## 14. Resumo executivo e próximo passo

**Estado em 2026-10-13.** Fluxo aluno → coordenação → decisão funcionando sobre **Next.js 16 +
Supabase**, agora estruturado conforme a doutrina (serviços, DTOs, erros traduzidos, sessão em
cookie, Server Components, design system). Build, lint e tipos verdes; **sem testes e sem
validação manual com sessão real**. O schema do banco não mudou.

**Próximos passos sugeridos (a combinar):**
1. Rodar o fluxo completo (aluno e coordenador) e corrigir o que aparecer.
2. `supabase db pull` → baseline em `supabase/migrations`; auditar/versionar RLS.
3. Aplicar a policy de storage e, após validar, tornar o bucket privado.
4. Aplicar índices, `reviewed_by/at`, view de resumo e FK `activity_type_id` (e ajustar serviços/DTOs).
5. Paginar a fila da coordenação; testes (serviços/RLS) e CI.
6. Definir hospedagem e finalizar `deploy.md`.
