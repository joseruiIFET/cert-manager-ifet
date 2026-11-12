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
- **Nunca** transformar página em client só para checar sessão. O gate vive em `proxy.ts`.
- Dados estáticos (textos, listas de eixos) ficam no servidor.

---

## 2. Data fetching & cache

- **Não buscar em `useEffect` sem cache.** Cada navegação refaz o round-trip e a tela "trava".
- **Server Components** buscam direto pelo serviço (cliente Supabase de servidor); use
  `revalidatePath`/`revalidateTag` após mutações (Server Actions).
- **Leituras no cliente** (filtros, polling): filtros combinados (eixo, tipo, status, busca textual)
  são executados em memória com memoização via `useMemo` sobre a lista já carregada pelo Server Component,
  proporcionando resposta instantânea (< 16 ms) sem novos round-trips de rede.
- Mostre o cache na hora e atualize em segundo plano; tela em branco esperando rede é o pior caso.
- Requisições independentes em `Promise.all` (já feito na carga inicial das telas — manter).

---

## 3. Higiene de query (Supabase/PostgREST)

- **Nunca** `await` de query dentro de `map`/`for` (N+1). Use `select('*, profiles(id, full_name)')`
  (join embutido), `.in('id', ids)` ou RPC.
- **Selecione colunas, não `*`**, quando a tela não usa tudo.
- **Toda listagem nasce com `order` + `limit`/`range`.** A tela da coordenação lê resumos leves
  e busca certificados sob demanda por aluno.
- **Índices de banco:**
  - `certificates_activity_type_id_idx` cobrindo a FK de tipo de atividade.
  - `certificates_student_status_idx` cobrindo filtros combinados de aluno e situação.
  - `activity_types_eixo_idx` cobrindo consultas e filtros por categoria.
- **RLS tem custo:** policy com subselect roda por linha. Use `(select auth.uid())` (avaliado uma
  vez) e indexe as colunas usadas nas policies.
- **Controle de concorrência:** trigger transacional `trg_check_certificate_reservation` garante
  validação atômica e proteção contra estouro de cotas em envios simultâneos.

---

## 4. Supabase — específicos

- **Cliente por contexto** (`@supabase/ssr`): browser, servidor, middleware. Não instanciar
  `createClient` a cada render.
- **Storage:** gere *signed URLs* em lote (`createSignedUrls`) para listas, nunca uma por item.
  Defina tamanho máximo e comprimir imagens antes do upload quando possível.
- **Escrita otimista** onde for seguro (marcar lido); reverta se falhar. Decisão da coordenação
  (aprovar/rejeitar) atualiza estado local imediatamente com reordenação por pendências.

---

## 5. Bundle & code-splitting

- Meça o **First Load JS** a cada feature (`next build`); chunk > ~150–200 KB, investigue.
- Dependências enxutas: apenas `@supabase/supabase-js`, `@supabase/ssr`, Next.js e React.
- Módulo puro `lib/domain/hoursCalculation.ts` com zero dependências externas.
- Ícones: SVG próprios em `components/Icones` (sem emoji, sem biblioteca inteira).

---

## 6. Checklist (ao criar/revisar uma tela)

- [ ] Precisa mesmo ser `"use client"`? O conteúdo poderia ser Server?
- [ ] Alguma leitura remota sem cache/dedupe?
- [ ] Query sem `order` + `limit`/`range`? `await` de query dentro de loop?
- [ ] Índice para o filtro/ordem usado? Policy RLS indexada?
- [ ] Todo clique dá feedback < 100 ms, sem tela branca?
- [ ] `next build` passa sem alertas de bundle?

---

## 7. Status de aplicação (2026-11-08)
✅ Server Components com ilhas client; gate em `proxy.ts`; `next/font`; sem Tailwind;
coordenação carrega certificados do aluno sob demanda, com cache; filtros combinados em memória
instantâneos; índices e trigger de concorrência versionados em `supabase/migrations/20261108_categories_progress_hours.sql`.
