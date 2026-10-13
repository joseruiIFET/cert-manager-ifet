# Cert Manager IFET — Prompt de Contexto do Projeto

> Documento raiz de contexto técnico do **cert-manager-ifet**. Descreve **o sistema como ele é
> hoje** (2026-10-13, branch única, 1 commit: `Primeira versao funcionando`) e como ele se
> relaciona com a doutrina em `spec/`.
>
> **Convenção de referência ao código: cite o símbolo, nunca a linha.**
> `StudentDashboard.handleSubmit`, não `student/page.jsx:86`. Números de linha apodrecem a cada
> edição; nomes de função são encontráveis com `grep`.
>
> **Documentos-irmãos:**
> — **Doutrina** (como deve ser): `arch.md` (arquitetura), `performance.md` (velocidade),
>   `design.md` (design system).
> — **Operação**: `deploy.md`.
> — **Estado real** (como é): este arquivo.
>
> ✅ **Doutrina adaptada (2026-10-13).** `arch.md`, `deploy.md`, `performance.md` e `design.md`
> foram reescritos para **este** sistema (Next.js + Supabase). Eles descrevem o **alvo**; a §9
> audita o código atual contra eles. Decisão de migrations: **Supabase CLI, não Flyway**
> (`arch.md` §8, `deploy.md` §4). Hospedagem do app ainda **pendente** (Vercel × servidor).
>
> **Estado desta fase:** *somente documentação.* Nenhum arquivo de código foi alterado.
> O ajuste do projeto à doutrina é a **fase seguinte**.

---

## 1. O que é o sistema

Plataforma web para **gestão de certificados de atividades complementares** de alunos de um
Instituto Federal (IFET). O aluno envia certificados (PDF/imagem) e acumula horas; a coordenação
analisa, aprova ou rejeita (com motivo) e acompanha o progresso de cada aluno rumo à carga
mínima (**120 horas**, hardcoded hoje).

**Dois atores, um ciclo:**

```
COORDENADOR (role = 'coordinator')
   cadastra CURSOS e REGRAS de atividade (eixo, mín/teto de horas, comprovante exigido)
   analisa certificados PENDENTES → APROVA ou REJEITA (motivo obrigatório)
   acompanha o progresso de horas por aluno
                                   ▲                         │ rejeitado: volta ao aluno
                                   │ pending                 ▼
ALUNO (qualquer outro role)  ──▶ CERTIFICADO ──▶ (approved | rejected)
   escolhe o tipo de atividade, informa título e horas, anexa arquivo
   corrige certificados rejeitados (reenvio volta para `pending`)
   vê horas aprovadas / 120
```

**Máquina de estados do certificado** (`certificates.status`): `pending` → `approved` |
`rejected`; `rejected` → (aluno corrige) → `pending`.

---

## 2. Mapa do repositório

| Caminho | Papel |
|---|---|
| `app/layout.tsx` | Layout raiz (`lang="pt-BR"`, título "Cert Manager"; só importa `globals.css`) |
| `app/page.tsx` | **Template padrão do create-next-app** (ainda não é a home real) |
| `app/login/page.tsx` + `login.module.css` | Login (e-mail + senha) e redirecionamento por role |
| `app/dashboard/student/` | `layout.js` (gate), `page.jsx` (painel do aluno), `student.module.css` |
| `app/dashboard/coordinator/` | `layout.js` (gate de role), `page.tsx` (análise), `coordinator.module.css` |
| `app/dashboard/coordinator/activities/` | `page.jsx` — CRUD de cursos e regras de atividade + `activities.module.css` |
| `lib/supabase.js` | Cliente Supabase único (anon key no browser) |
| `spec/` | Doutrina (`arch`, `performance`, `design`, `deploy`) e este contexto |
| `.env.local` | `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `.next/`, `node_modules/` | Artefatos (fora do git) |

**Não existem:** `src/`, `services/`, `components/`, `hooks/`, `middleware.ts`, testes,
Dockerfile/compose, migrations SQL versionadas, `.env.example`, `README` específico (o atual é o
do create-next-app). Os comentários de cabeçalho `/* ARQUIVO: src/app/... */` em alguns arquivos
são resquício de uma estrutura `src/` que **não existe**.

**Volume:** ~1.760 linhas entre páginas e CSS (5 páginas, 3 layouts, 4 CSS Modules).
Mistura de extensões: `.tsx` (login, coordinator, layout raiz, home) e `.jsx`/`.js` (student,
activities, layouts de dashboard).

---

## 3. Como rodar

```bash
npm install
npm run dev      # :3000
npm run build    # next build
npm run lint     # eslint (eslint-config-next)
npx tsc --noEmit # typecheck (tsconfig existe, mas há JS/JSX misturado)
```

**Configuração:** `.env.local` com as duas variáveis `NEXT_PUBLIC_SUPABASE_*`. A anon key é
pública por desenho do Supabase — **a segurança real depende inteiramente de RLS** (ver §8).
Não há nenhum arquivo de ambiente de exemplo.

---

## 4. Stack real (versões do `package.json`)

- **Next.js 16.0.8** (App Router) · **React 19.2.1** · TypeScript 5 (`tsconfig` presente)
- **@supabase/supabase-js ^2.87** — Auth + Postgres (PostgREST) + Storage, **direto do browser**
- **Tailwind CSS 4** instalado e importado em `globals.css`, **mas não usado** nas telas (todas
  usam CSS Modules). Só a home-template usa classes Tailwind.
- ESLint 9 + `eslint-config-next`
- **Sem:** SWR/TanStack Query, zod/yup, axios, lib de ícones (usa emoji), toast (usa
  `alert`/`confirm`/`prompt`), lib de testes.

---

## 5. Modelo de dados (inferido do código — **não há schema versionado**)

Backend = **Supabase** (Postgres gerenciado). As tabelas abaixo são deduzidas das queries; o DDL
e as policies **não estão no repositório** e precisam ser levantados no painel do Supabase.

| Tabela | Colunas observadas | Notas |
|---|---|---|
| `profiles` | `id` (= `auth.users.id`), `full_name`, `email`, `role` | `role === 'coordinator'` → coordenação; qualquer outro valor → aluno |
| `courses` | `id`, `name` | Criada pela coordenação |
| `activity_types` | `id`, `course_id`, `eixo` (`Tecnológico`/`Integrador`/`Básico`), `description`, `min_hours`, `max_hours`, `proof_type`, `is_active` | As "regras oficiais" |
| `certificates` | `id`, `student_id`, `title`, `category`, `hours`, `file_url`, `status` (`pending`/`approved`/`rejected`), `feedback`, `created_at` | `category` guarda o **texto** de `activity_types.description` (não o id!) |
| Storage bucket `documents` | `{user.id}/{timestamp}.{ext}` | URL **pública** gravada em `file_url` |

**Observações de modelagem:**
- `profiles.id` = UID do Auth ✅ (alinhado ao `arch.md` §4).
- `certificates` → `activity_types` é um vínculo **por nome** (`category` ↔ `description`), não por
  FK; renomear uma regra quebra o vínculo com certificados antigos.
- `feedback` acumula o histórico de rejeições como texto concatenado
  (`[data] motivo\n----------------\n…`) — não é estruturado.
- A carga total (**120h**) está duplicada em dois arquivos e não vem de `courses`.

---

## 6. Fluxos implementados

**Login (`LoginPage.handleLogin`)**: `supabase.auth.signInWithPassword` → consulta
`profiles.role` → `/dashboard/coordinator` se `coordinator`, senão `/dashboard/student`. Erro do
Supabase aparece cru na tela (`err.message`).

**Gate de sessão (`StudentLayout` / `CoordinatorLayout`)**: `'use client'` + `useEffect` →
`supabase.auth.getUser()`; coordenador ainda lê `profiles.role`. Sem sessão → `/login`; aluno no
painel do coordenador → `/dashboard/student`. Enquanto verifica, mostra "Carregando…" com
estilo inline. **Não há `middleware.ts`.**

**Aluno (`StudentDashboard`)**: carrega `certificates` (todos — depende de RLS filtrar por
dono) e `activity_types` ativos em `Promise.all`; modal de envio/edição; upload ao bucket
`documents` e `getPublicUrl`; insert/update com `status: 'pending'`; progresso =
soma das horas `approved` / 120. Rejeitado mostra `feedback` e botão **Corrigir**.

**Coordenação (`CoordinatorDashboard`)**: busca **todos** os certificados com join em `profiles`
e todas as `activity_types`; agrupa por aluno em memória; ordena alunos por nº de pendências;
`handleDecision` faz `update` direto na tabela (`status`, `feedback`) com `prompt()` para o
motivo e `confirm()` para aprovar; atualiza o estado local por mutação do objeto. Mostra regra
oficial (mín/teto/comprovante) e alerta "abaixo do mínimo".

**Configuração de atividades (`ActivitiesManager`)**: CRUD de `activity_types` por curso e
criação de curso via `prompt()`; exclusão com `confirm()`.

---

## 7. Superfície de integração

Não há API própria. Toda integração é o cliente Supabase usado **diretamente nas páginas**:

| Operação | Onde |
|---|---|
| `auth.signInWithPassword`, `auth.getUser` | `login`, os dois `layout.js`, `student/page` |
| `from('profiles').select('role')` | `login`, `coordinator/layout` |
| `from('certificates')` select/insert/update | `student/page`, `coordinator/page` |
| `from('activity_types')` select/insert/update/delete | `student/page`, `coordinator/page`, `activities/page` |
| `from('courses')` select/insert | `activities/page` |
| `storage.from('documents').upload/getPublicUrl` | `student/page` |

Há **13 chamadas ao Supabase espalhadas em 6 arquivos de UI**; nenhuma camada de serviço.

---

## 8. Segurança — como está montado

- Autenticação: Supabase Auth (JWT gerido pela lib; sessão persistida no storage do browser).
- **Autorização inteiramente client-side + RLS (desconhecida).** O role é lido no browser para
  decidir tela; o que impede um aluno de chamar `update certificates set status='approved'` pelo
  console é **somente** a RLS — que não está versionada nem auditada. **Risco crítico a verificar
  primeiro.**
- Upload sem validação de tipo/tamanho/assinatura; bucket `documents` com **URL pública**
  (certificados contêm dados pessoais) — avaliar bucket privado + signed URL.
- Role "coordinator" por string em `profiles.role`; o fluxo de criação/promoção de coordenador
  não existe no código (feito direto no banco).
- Sem rate limiting, sem CSP, sem cabeçalhos de segurança em `next.config.ts` (vazio).
- Mensagens de erro de infra (`error.message` do Supabase) chegam à interface.

---

## 9. Auditoria contra a doutrina de `spec/`

### `arch.md`

| § | Regra | Status | Evidência |
|---|---|---|---|
| 1 | Camada Adapter/DTO; UI agnóstica ao backend | ❌ | 13 chamadas `supabase.from(...)` diretas nas páginas; retornos brutos usados em JSX (`cert.file_url`, `profiles`) |
| 1 | Retorno consistente entre métodos | ❌ | Sem serviços; shapes ad hoc (`curr.profiles`, `rule.min_hours`…) |
| 2 | JWT/`Authorization: Bearer` | ✅ (delegado) | O SDK do Supabase anexa o token; não há header customizado |
| 2 | Criação de contas de terceiros só pelo servidor | ⚪ n/a hoje | Não existe cadastro; ao criar, usar Server Action + service role |
| 3 | Sem `window`/`localStorage` em escopo de módulo | ✅ | Nenhum acesso direto; o SDK cuida da sessão |
| 3 | Preferir cookies HttpOnly | ❌ | Sessão Supabase no `localStorage` (cliente `createClient` puro); migrar para `@supabase/ssr` |
| 4 | ID do banco = ID da auth | ✅ | `profiles.id = user.id` |
| 4 | `PUT` x `PATCH` | ⚪ n/a | Sem REST próprio; `.update()` do PostgREST é parcial (PATCH) |
| 5 | Serviços sem malabarismo de formatação; validação no formulário | ❌ | Validação por `alert()`; `parseInt` e montagem de payload dentro do handler; sem zod |
| 5 | Upload em serviço próprio | ❌ | Upload dentro de `handleSubmit` da tela |
| 6 | Blindagem de erros | ❌ | `error.message` do Supabase vai para `alert`/tela; sem tradução |
| 7 | Regra do copy & paste | ⚠️ | Dois layouts quase idênticos; `Math.min(.../120)` duplicado; texto "ATENÇÃO: …" e comentários de trabalho no código |

### `performance.md`

| § | Regra | Status | Evidência |
|---|---|---|---|
| 0/1 | `"use client"` é folha; Server Component quando possível | ❌ | Todas as páginas e layouts são `'use client'` |
| 1 | Gate de sessão em `middleware.ts` | ❌ | Gate em `useEffect` nos layouts; tela "Carregando…" a cada entrada |
| 2 | Cache + dedupe + stale-while-revalidate | ❌ | `useEffect(fetch)` em toda tela, sem cache |
| 3 | N+1 / `orderBy` + `limit` | ⚠️ | Sem N+1; mas coordenação lê **todos** os certificados sem `limit`/paginação |
| 3 | Contar/agregar no servidor | ❌ | Soma de horas e agrupamento feitos no cliente sobre a tabela inteira |
| 5 | Bundle / imports dinâmicos | ✅ (trivial) | Só `@supabase/supabase-js`; sem libs de ícones |
| 6 | `next/image`, fontes via `next/font` | ⚠️ | Fonte do sistema (`-apple-system…`) nos módulos; `globals.css` define `Arial`; template usa `next/image` |
| 7 | Feedback < 100 ms; `Promise.all` | ⚠️ | `Promise.all` presente; feedback por `alert`/"Carregando…" sem skeleton |
| 7 | Evitar `alert/confirm/prompt` bloqueantes | ❌ | Usados em quase toda ação |

### `design.md` (alvo; não implementado)

O `design.md` define o alvo (verde-floresta `#2D6A4F`, tokens no
`:root`, DM Sans, shell com topbar + sidebar 280px, ícones SVG, `Toast`). Estado aqui:
- **Sem tokens**: cores hardcoded em cada CSS Module (azul-frio `#f8fafc`, `#2563eb`, `#e5e7eb`…
  e *inline styles* em JSX).
- **Sem design system compartilhado**: botões, modal, badge, card reimplementados por página.
- **Emojis como ícones** (⚙️ 📄 ✏️ 🗑️ 📋 ⚠️ 📜) — o `design.md` manda SVG desenhado.
- **Modais próprios** sem foco/ESC/ARIA; **feedback por `alert`**.
- Breakpoints/responsividade: a conferir (`coordinator.module.css` usa `height:100vh` + sidebar fixa).
- Tailwind carregado e não usado; `globals.css` com tema claro/escuro do template.

### `deploy.md` (alvo; não implementado)

Descreve Docker Compose, Postgres, Flyway, `--env-file`, servidores da escola. Aqui: **não há
Docker, banco próprio nem migrations**; o banco é um projeto Supabase hospedado. Pendente
decidir o alvo de deploy (Vercel? servidor da escola com `next start`/container?) — ver §10.

---

## 10. Mapa de transposição da doutrina para este projeto

| Doutrina (origem: Monitoria) | Equivalente neste projeto |
|---|---|
| `src/services/*` com Adapter/DTO (`arch.md` §1) | `lib/services/{certificates,activityTypes,courses,profiles,storage}Service.ts` sobre o cliente Supabase; mappers `_mapCertificate()` etc. com tipos em `lib/types.ts` |
| JWT em `Authorization: Bearer` | Sessão Supabase; para Server Components/Actions, `@supabase/ssr` (cookies HttpOnly) |
| Criação de contas via servidor | Server Action + `supabase.auth.admin` (service role **apenas no servidor**) |
| Blindagem de erros (`ApiError`) | Camada que traduz `PostgrestError`/`StorageError` → mensagens em português |
| Validação na borda (zod) | Schemas por formulário (certificado, regra, curso); decisão entre zod ou validação manual a registrar |
| Gate em `middleware.ts` | Middleware lendo a sessão por cookie + role; fim dos `layout.js` com `useEffect` |
| Flyway + `ddl-auto=validate` | Migrations do **Supabase CLI** (`supabase/migrations/*.sql`) com RLS versionada |
| `ConsultasConstantesTest` (§9 do `performance.md`) | Medição: nº de requisições por tela com 2 vs 6 alunos; agregação por view/RPC em vez de somar no cliente; `limit`/paginação |
| `@EntityGraph` / batch | `select('*, profiles(...)')` já usado; manter, e paginar com `range()` |
| Docker Compose / `deploy.md` | A definir: Vercel **ou** container Next standalone; `NEXT_PUBLIC_*` são fixadas **no build** (mesma pegadinha do `NEXT_PUBLIC_API_BASE`) |
| Tokens/`shell.module.css`/`Toast`/ícones SVG | `:root` único em `globals.css`, shell de dashboard compartilhado, `Toast`, `Icones` SVG, `Modal` acessível |
| `promptContexto.md` §13 (dívida) | §11 abaixo |

---

## 11. Dívida técnica (ordenada por risco)

### 🔴 Risco vivo
1. **RLS desconhecida/não versionada.** Sem ela, o cliente com anon key pode ler/alterar
   certificados de qualquer aluno e aprovar o próprio. Levantar as policies atuais e testar
   como aluno.
2. **Bucket `documents` público** com dados pessoais (certificados).
3. **Promoção/criação de coordenador** feita manualmente no banco; sem trilha de quem aprovou/
   rejeitou cada certificado (`approved_by`, `reviewed_at` ausentes).

### 🟠 Antes de expor a mais gente
- Sem validação de upload (tipo, tamanho, assinatura binária).
- `category` por nome em vez de FK `activity_type_id`.
- Coordenação carrega a tabela inteira de certificados (sem `limit`/paginação, agrupamento no cliente).
- Mensagens de erro de infra expostas ao usuário.
- 120 horas hardcoded; deveria ser regra por curso.
- Aprovar certificado sem checar teto (`max_hours`) do tipo de atividade.

### 🟡 Qualidade e escala
- Sem camada de serviço (13 chamadas diretas); sem tipos (JS/JSX misturado com TSX; `any` implícito).
- Tudo `'use client'`; sem cache/SWR; gate de sessão por `useEffect`.
- `alert/confirm/prompt` no lugar de Toast/Modal de confirmação/campo de motivo.
- CSS sem tokens; cores inline; emoji como ícone; Tailwind instalado e ignorado.
- `app/page.tsx` ainda é o template; `README.md` é o do create-next-app.
- Sem testes, sem `.env.example`, sem CI, sem Dockerfile/definição de deploy.
- Comentários de trabalho no código ("ATENÇÃO…", "COLA DE VOLTA", "Aquele arquivo que criamos…").

---

## 12. Convenções a respeitar ao editar (valem já)

- **Nunca** altere a lógica sem antes ler a doutrina relevante de `spec/` (`arch.md` antes de
  criar serviço/tela, `performance.md` antes de criar tela/query, `design.md` antes de CSS).
- **Código novo** nasce na doutrina: serviço em `lib/services` retornando DTO puro; UI sem
  `supabase.from`; erro traduzido; feedback por Toast, não `alert`.
- **Server Component por padrão**; `"use client"` só em folhas interativas.
- **Copy & paste:** ao duplicar tela/serviço (aluno → coordenação), revisar tabela, colunas,
  textos e comentários.
- Textos de interface e comentários em **português**, comentando o *porquê*.
- Mensagens de commit em português, descritivas.
- Qualquer coluna/tabela nova ⇒ **migration versionada** na mesma alteração (a criar).
- Segredos: `.env.local` fora do git; **nunca** expor service role em `NEXT_PUBLIC_*`.

---

## 13. Onde cavar mais fundo

| Preciso de... | Vou em... |
|---|---|
| Regras de decisão do coordenador | `app/dashboard/coordinator/page.tsx` › `handleDecision`, `CertCard` |
| Envio/correção de certificado do aluno | `app/dashboard/student/page.jsx` › `handleSubmit`, `handleEdit` |
| Cadastro de cursos e regras | `app/dashboard/coordinator/activities/page.jsx` |
| Login e roteamento por papel | `app/login/page.tsx` › `handleLogin` + os dois `layout.js` |
| Cliente Supabase | `lib/supabase.js` |
| Doutrina de arquitetura / performance / design / deploy | `spec/arch.md`, `spec/performance.md`, `spec/design.md`, `spec/deploy.md` |

---

## 14. Resumo executivo e próximo passo

**Estado em 2026-10-13.** Protótipo funcional ("primeira versão") de gestão de certificados
sobre **Next.js 16 + Supabase**: fluxo aluno → coordenação → decisão funcionando, 5 telas,
0 testes. O **modelo de domínio é simples e correto na essência**; o que falta é **estrutura**:
tudo é `'use client'` falando direto com o banco, sem serviços, sem validação, sem tokens de
design, sem RLS versionada, sem alvo de deploy.

**O que está sólido:** o fluxo de negócio (pending → approved/rejected → correção); `profiles.id`
= UID da auth; uso de `Promise.all`; join `certificates → profiles` em uma só query.

**Segunda fase (proposta, a executar só mediante aprovação):**
1. **Segurança de dados:** levantar e versionar RLS/schema; bucket privado + signed URL; validar upload.
2. **Arquitetura:** `lib/types.ts` + `lib/services/*` (Adapter, erro traduzido); remover `supabase.from` da UI; validação na borda.
3. **Sessão:** `@supabase/ssr` + `middleware.ts`; layouts viram Server Components.
4. **Performance:** Server Components para listagens; cache/SWR para leituras client; paginação e agregação do progresso no banco; `next/font`.
5. **Design:** tokens no `:root`, shell compartilhado, `Toast`/`Modal`/`ConfirmDialog`, ícones SVG, responsividade (968px/480px).
6. **Deploy:** decidir Vercel × container; `.env.example`; README real; CI com `lint` + `tsc` + `build`.
7. **Manter os `spec/` em dia:** quando o CSS/código divergir da doutrina, corrigir o documento (design) ou o código (arch/performance).
