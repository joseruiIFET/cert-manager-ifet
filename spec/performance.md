# ⚡ Diretrizes de Performance — Cert Manager IFET (Next.js + Supabase)

> Documento-irmão do `arch.md` (arquitetura) e `design.md` (UI). Enquanto o `arch.md` cuida de
> **desacoplamento**, este cuida de **velocidade percebida**. A IA deve consultá-lo antes de criar
> telas, serviços ou queries.

---

## 0. Princípio mestre

**Trabalho que não precisa acontecer no cliente, não acontece no cliente.** Cada byte de JS e cada
round-trip é imposto ao aparelho do aluno (frequentemente celular em 4G). Ordem de preferência:

```
1. Estático em build (SSG)         ← conteúdo que não muda por request
2. Server Component (RSC)          ← precisa de dados, não de interação
3. Client Component ("use client") ← SÓ com estado/efeito/evento do browser
```

---

## 1. Server vs Client Components

- **`"use client"` é folha, não raiz.** Só componentes que usam `useState`/`useEffect`/eventos.
- **Server shell + client island:** a página do aluno é um Server Component que busca os
  certificados e renderiza a lista; só o `<CertificateFormModal/>`, filtros e botões são client.
  - ❌ Hoje: `student/page.jsx` e `coordinator/page.tsx` inteiros em `'use client'`.
  - ✅ Alvo: `page` (server) busca via serviço; ilhas client recebem props.
- **Nunca** transformar página em client só para checar sessão. O gate vive em `middleware.ts`.
- Dados estáticos (textos, listas de eixos) ficam no servidor.

---

## 2. Data fetching & cache

- **Não buscar em `useEffect` sem cache.** Cada navegação refaz o round-trip e a tela "trava".
- **Server Components** buscam direto pelo serviço (cliente Supabase de servidor); use
  `revalidatePath`/`revalidateTag` após mutações (Server Actions).
- **Leituras no cliente** (filtros, polling): SWR ou TanStack Query — dedupe, cache por chave,
  stale-while-revalidate. **Invalide** a chave ao escrever (`certificates:<studentId>`).
- Mostre o cache na hora e atualize em segundo plano; tela em branco esperando rede é o pior caso.
- Requisições independentes em `Promise.all` (já feito na carga inicial das telas — manter).

---

## 3. Higiene de query (Supabase/PostgREST)

- **Nunca** `await` de query dentro de `map`/`for` (N+1). Use `select('*, profiles(id, full_name)')`
  (join embutido), `.in('id', ids)` ou RPC.
- **Selecione colunas, não `*`**, quando a tela não usa tudo.
- **Toda listagem nasce com `order` + `limit`/`range`.** A tela da coordenação hoje lê *todos* os
  certificados de *todos* os alunos — cresce sem teto. Paginar (`range(from, to)`) e filtrar no
  servidor (por status, curso, aluno).
- **Conte e some no banco.** "Horas aprovadas por aluno" e "pendências por aluno" são agregação:
  view/RPC (`sum(hours) … group by student_id`) ou `select(…, { count: 'exact', head: true })`.
  Não traga N linhas para `reduce` no cliente.
- **Índices:** FK e colunas de filtro/ordem (`certificates.student_id`, `status`, `created_at`,
  `activity_type_id`) têm índice — Postgres **não** indexa FK sozinho. Índice parcial para
  `status = 'pending'` na fila da coordenação.
- **RLS tem custo:** policy com subselect roda por linha. Use `(select auth.uid())` (avaliado uma
  vez) e indexe as colunas usadas nas policies.

---

## 4. Supabase — específicos

- **Cliente por contexto** (`@supabase/ssr`): browser, servidor, middleware. Não instanciar
  `createClient` a cada render.
- **`getUser()` valida o token no Auth** (round-trip); `getSession()` lê do cookie. No middleware
  use o que `@supabase/ssr` recomenda; evite chamar `getUser()` em cada componente — leia uma vez
  e passe por props/contexto.
- **Storage:** gere *signed URLs* em lote (`createSignedUrls`) para listas, nunca uma por item.
  Defina tamanho máximo e comprimir imagens antes do upload quando possível.
- **Realtime só com critério** (ex.: aluno ver decisão sem recarregar); custa conexão persistente.
- **Escrita otimista** onde for seguro (marcar lido); reverta se falhar. Decisão da coordenação
  (aprovar/rejeitar) pode ser otimista com rollback.

---

## 5. Bundle & code-splitting

- Meça o **First Load JS** a cada feature (`next build`); chunk > ~150–200 KB, investigue.
- Dependências só entram com motivo. Hoje: apenas `@supabase/supabase-js` — manter assim.
- Modal de formulário, visualizador de PDF e libs pesadas por `next/dynamic`/`import()`.
- Ícones: SVG próprios em `components/Icones` (sem emoji, sem biblioteca inteira).
- Remova peso morto: Tailwind está instalado e **não usado** — usar de fato ou remover.

---

## 6. Imagens, fontes & assets

- `next/image` para imagens; `aspect-ratio` reservado (anti-CLS).
- **Fontes por `next/font`**, nunca `@import` de CSS externo (cascata bloqueante).
- Pré-visualização de certificado: miniatura dimensionada, não o arquivo original.

---

## 7. Rede & percepção

- **Feedback < 100 ms:** todo clique responde (skeleton, estado do botão). Skeleton na mesma
  geometria do conteúdo. **Sem `alert()`/`confirm()`/`prompt()` bloqueantes** — usar Toast e modal.
- **Evite waterfalls** (`Promise.all`).
- **Compressão** na origem (Vercel/Next já comprimem; se `next start` atrás de proxy, confira).
- **Região:** hospede o app na mesma região do projeto Supabase para reduzir latência por query.

---

## 8. Checklist (ao criar/revisar uma tela)

- [ ] Precisa mesmo ser `"use client"`? O conteúdo poderia ser Server?
- [ ] Alguma leitura remota sem cache/dedupe?
- [ ] Query sem `order` + `limit`/`range`? `await` de query dentro de loop?
- [ ] Soma/contagem feita no cliente que deveria ser no banco?
- [ ] Índice para o filtro/ordem usado? Policy RLS indexada?
- [ ] Dependência/SDK pesado no bundle inicial que poderia ser dinâmico?
- [ ] Todo clique dá feedback < 100 ms, sem tela branca?
- [ ] `next build` — algum First Load JS fora da curva?

**Teste final:** throttle 4G + CPU 4x. Se o clique "trava": round-trip sem cache, bundle pesado
ou trabalho síncrono no caminho crítico.

---

## 9. Postgres/Supabase — medição e padrões deste sistema

> A regra que vale mais que as outras: **meça.** Nenhuma afirmação de performance entra sem número.

### 9.1 O molde de medição
Rode a mesma operação com **2** e com **6** alunos/certificados e exija o **mesmo número de
requisições/queries**. Número que cresce com o volume é a assinatura do N+1.

- Contar requisições à API por tela (aba Network ou log do Supabase).
- `EXPLAIN (ANALYZE, BUFFERS)` no SQL Editor para queries da coordenação com volume realista
  (ex.: 5 mil certificados).
- Seed de volume em `supabase/seed.sql` (ou script) para testar paginação e agregações.

### 9.2 Ordem de ataque: query → índice → agregação → arquitetura
1. **Selecionar menos** (colunas, filtro, `limit`).
2. **Join embutido** no lugar de várias queries.
3. **Índice** no filtro/ordem e nas colunas das policies RLS.
4. **Agregação no banco** (view/RPC) para progresso de horas e contadores.
5. **Cache** (RSC + `revalidate*`, SWR) e só então realtime.

### 9.3 Os pontos quentes do sistema
- **Fila da coordenação:** listar alunos com pendências → view `student_review_summary`
  (`student_id, pending_count, approved_hours`) paginada; certificados do aluno selecionado
  carregados **sob demanda** (não todos de todos).
- **Painel do aluno:** `certificates` do próprio aluno (RLS filtra) + horas aprovadas por
  agregação, não `reduce` sobre a lista.
- **Listas com arquivo:** *signed URLs* geradas sob demanda ao abrir o certificado, ou em lote.

### 9.4 Higiene que não é N+1, e ainda assim custa
- Não use `select('*')` em tabela com colunas de texto grande (`feedback`).
- Não gere URL assinada por item numa lista inteira.
- Não faça o cliente recarregar a lista inteira após cada mutação; atualize o item (ou
  `revalidatePath`) e mantenha filtros.

### 9.5 Checklist de backend/banco (ao criar listagem ou RPC)
- [ ] A query tem `order` + `limit`/`range`?
- [ ] A agregação roda no banco?
- [ ] Há índice cobrindo filtro, ordem e a policy RLS?
- [ ] A policy usa `(select auth.uid())`?
- [ ] A contagem de requisições da tela é constante com 2 e com 6 registros?

---

## 10. Status de aplicação (2026-10-13)
✅ Server Components com ilhas client; gate em `proxy.ts`; `next/font`; sem Tailwind; sem
`alert/confirm/prompt`; coordenação carrega certificados do aluno sob demanda, com cache.
🟡 Fila da coordenação **ainda** sem paginação e somada no cliente (provisório até a view
`student_review_summary`); sem SWR. ❌ Índices propostos em `supabase/proposals/`, não aplicados.
