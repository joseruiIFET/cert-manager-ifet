# 🏛️ Diretrizes de Arquitetura — Cert Manager IFET

Regras de engenharia para o frontend do **sistema de certificados** (Next.js + Supabase como BaaS).
O objetivo é um código escalável, seguro e **resiliente a mudanças de infraestrutura** — hoje o
Supabase é o backend; amanhã pode ser uma API dedicada, e a UI não deve perceber.

> **Documentos-irmãos:** `design.md` (UI), `performance.md` (velocidade), `deploy.md` (operação),
> `promptContexto.md` (estado real do projeto e auditoria contra estas regras).

## 1. Camada Anticorrupção e Desacoplamento (Padrão Adapter)
A interface é estritamente **agnóstica** em relação ao backend.
* **Proibido vazar infraestrutura:** componentes React nunca chamam `supabase.from(...)`,
  `supabase.storage` nem `supabase.auth` diretamente, e nunca recebem objetos brutos do SDK
  (`PostgrestResponse`, `PostgrestError`, `User` do Supabase).
* **Serviços em `lib/services/`:** `certificatesService`, `activityTypesService`, `coursesService`,
  `profilesService`, `storageService`, `authService`. Cada um é o **único** lugar que importa o
  cliente Supabase.
* **DTOs puros:** serviços retornam objetos TypeScript simples, tipados em `lib/types.ts`
  (ex.: `Certificate`, `ActivityType`, `Course`, `Profile`). Nada de `snake_case` do banco na UI.
* **Consistência de retorno:** `list`, `getById`, `listByStudent` devolvem exatamente o mesmo DTO,
  via funções privadas de mapeamento (`_mapCertificate(row)`).

## 2. Segurança e Gestão de Sessão
* **A segurança mora no banco (RLS), não na tela.** A `anon key` é pública por desenho; **toda
  tabela e todo bucket têm Row Level Security**, versionada em migration. Esconder um botão ou
  redirecionar em `layout.js` é UX, nunca autorização.
* **JWT padrão:** a sessão Supabase (JWT) é a identidade. Proibido trafegar IDs crus em headers
  customizados. Em código de servidor, o token vem do cookie de sessão.
* **Sessão em cookies HttpOnly** via `@supabase/ssr` (clientes separados para browser, Server
  Component/Action e middleware). `localStorage` para token é desaconselhado.
* **Service role só no servidor.** A `SUPABASE_SERVICE_ROLE_KEY` jamais tem prefixo `NEXT_PUBLIC_`
  nem é importada em arquivo cliente.
* **Contas de terceiros** (coordenador cadastrando aluno/coordenador) ocorrem **exclusivamente em
  Server Action** com `auth.admin` — nunca com `signUp` no cliente, que destrói a sessão atual.
* **Papéis:** `profiles.role` é alterável apenas por coordenação/servidor (policy + trigger);
  usuário não promove a si próprio.
* **Arquivos sensíveis:** certificados contêm dados pessoais → bucket **privado** + *signed URL*
  de curta duração, não `getPublicUrl`.

## 3. Resiliência no Ecossistema Next.js (SSR vs CSR)
* Código de módulo não acessa `window`/`localStorage` diretamente; use verificação de ambiente ou
  cookies (que servem server e client).
* **Gate de rota em `middleware.ts`** (sessão + role), não em `useEffect` de layout.
* Server Components por padrão; `"use client"` só em folhas interativas (ver `performance.md`).

## 4. Modelagem de Banco e Semântica
* **ID de `profiles` = `auth.users.id`** (FK com `on delete cascade`), nunca um id paralelo.
* **Relações por FK, não por texto:** `certificates.activity_type_id → activity_types.id`
  (hoje existe o vínculo frágil por `category`/`description` — a corrigir).
* **Estados em enum/check:** `certificates.status in ('pending','approved','rejected')`,
  `profiles.role in ('student','coordinator')`.
* **Auditoria de decisão:** `reviewed_by`, `reviewed_at` em `certificates`; feedback de rejeição
  estruturado (tabela `certificate_reviews`), não texto concatenado.
* **Atualização parcial:** `.update({campos})` do PostgREST é PATCH; nunca reenviar a entidade
  inteira só para mudar um campo. Se houver API própria no futuro: `PUT` só para substituição total.
* **Regras de negócio críticas no banco** (trigger/RPC/check), não só no cliente: ex. teto de
  horas por tipo de atividade, transição válida de status.

## 5. Responsabilidade Única (SRP) e Validação
* **Serviços não higienizam dados.** O payload que chega a `create(payload)` já foi validado e
  normalizado pela camada de formulário (schema Zod ou validação manual centralizada).
* **Upload é domínio próprio:** `storageService` cuida de Storage (nome do arquivo, tipo, tamanho,
  signed URL), separado do CRUD de `certificates`.
* **Conta de horas única:** a regra "horas aprovadas / carga total" vive em **um lugar** (view/RPC
  no banco ou função em `lib/domain/`). Nunca somada em duas telas.

## 6. Blindagem de Erros
* Serviços usam `try/catch` e traduzem `PostgrestError`/`StorageError`/`AuthError` para erros
  padronizados em **português** (`throw new AppError("Certificado não encontrado")`).
* Códigos conhecidos mapeados: violação de unique/FK (`23505`/`23503`), RLS negou (`42501`),
  credencial inválida, rede indisponível.
* O componente apenas exibe a mensagem limpa em **Toast**; sem `alert()`, sem `error.message` cru.

## 7. Atenção Plena na Codificação (Regra do Copy & Paste)
* Ao duplicar um serviço ou tela (aluno → coordenação), altere **tabela, colunas, filtros,
  textos e comentários**. Salvar dados de uma entidade apontando para a tabela de outra é
  inaceitável.
* Sem comentários de rascunho ("ATENÇÃO…", "cola de volta"); comentário explica o **porquê**.

## 8. Migrations e Schema (Supabase)
* **Todo schema, policy RLS, trigger, função e bucket vive em `supabase/migrations/*.sql`**,
  versionado no git e aplicado pelo **Supabase CLI** (`supabase db push`). Mudança feita só no
  SQL Editor do painel **não existe** para o próximo ambiente.
* **Flyway não é usado.** Ele é tecnicamente possível contra o Postgres do Supabase, mas exige
  JVM, desconhece `auth`/`storage`/RLS como cidadãos de primeira classe e duplica o que o CLI já
  faz. Decisão registrada: **Supabase CLI**.
* **Nunca edite migration já aplicada** — crie uma nova.
* Tipos TypeScript do banco gerados por `supabase gen types typescript` em `lib/database.types.ts`
  e consumidos **apenas** dentro dos serviços.