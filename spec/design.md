# Design — Cert Manager IFET

Referência do design system do **sistema de certificados**. Define o **alvo** de UI para as
telas existentes (login, painel do aluno, painel da coordenação, configuração de atividades).

> **Documentos-irmãos:** `promptContexto.md` (estado real), `arch.md`, `performance.md`.
> **Estado atual vs. alvo:** hoje não há tokens; cada CSS Module tem cores próprias (azul-frio
> `#f8fafc`/`#2563eb`), emojis como ícones, `alert()`/`confirm()`/`prompt()` e modais sem
> acessibilidade. Este documento é a meta; **quando o CSS e este arquivo divergirem depois da
> implementação, o CSS é a verdade — corrija o documento.**
> **Decisão de identidade:** adotada a paleta **verde-floresta institucional** (a mesma
> linguagem da doutrina de origem). Se a escola preferir outra, mudar só os tokens da §2.

---

## 1. Visão geral

**Um idioma cromático: verde-floresta sobre fundo claro.** Duas encenações:

| Contexto | Encenação | Fundo | Card |
|---|---|---|---|
| Autenticação (`/login`) | Palco escuro com orbs verdes desfocados | `#0a1a12` + gradientes radiais verdes | Card **branco** flutuando |
| Dashboards (aluno / coordenação) | Superfície clara e plana | `#F5F6F4` | Cards brancos sólidos |

**Anti-flash:** `html` e `body` com `background-color: #F5F6F4` fixo; o palco de login pinta
o próprio fundo por cima — evita piscada branca/escura entre rotas.

---

## 2. Tokens (únicos, no `:root` de `globals.css`)

Os tokens vivem **uma vez**, no `:root`. Módulos CSS os **consomem**; nunca redeclaram nem
hardcodam cor.

```css
/* marca e superfícies */
--bg-primary:       #F5F6F4;   --bg-card:   #FFFFFF;   --bg-sidebar: #E8F5E9;
--accent:           #2D6A4F;   --accent-hover: #245a42;  --accent-light: #52B788;
--gradient-brand:   linear-gradient(135deg, #2D6A4F 0%, #52B788 100%);
--text-primary:     #1A1A1A;   --text-secondary: #6B7280;  --text-muted: #9CA3AF;
--border:           #E5E7EB;

/* semânticos — um significado por cor */
--success: #2D6A4F;  --warning: #C77600;  --danger: #B91C1C;  --info: #1D4ED8;

/* campos de formulário (borda própria, mais forte que a do card) */
--input-border: #d2dad3;  --input-border-hover: #A9B4AB;
--input-bg: #FBFCFB;      --input-ring: rgba(45,106,79,0.16);

/* forma */
--radius: 12px;  --radius-lg: 16px;  --spacing: 8px;  --sidebar-width: 280px;
--shadow:      0 2px 12px rgba(0,0,0,0.04);
--shadow-card: 0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04);
```

> **Cor de status significa uma coisa só:** `--danger` (vermelho) = destrutivo/rejeitado;
> `--warning` (âmbar) = atenção/pendente; `--success` (verde) = aprovado. Não reaproveitar
> `warning` como vermelho de ação destrutiva.

---

## 3. Status do certificado — vocabulário visual

Uma tabela, usada em **todas** as telas e pelo mesmo componente `StatusBadge`:

| Status (banco) | Rótulo | Cor | Ícone |
|---|---|---|---|
| `pending` | **Em análise** | `--warning` (âmbar) | relógio |
| `approved` | **Aprovado** | `--success` (verde) | check |
| `rejected` | **Rejeitado** | `--danger` (vermelho) | x |

- O rótulo é **português**, nunca o valor cru do banco (`pending`, `approved` na tela é bug).
- Cor **nunca é o único indício**: sempre ícone + texto (acessibilidade).
- Rejeitado **não é enterrado**: mostra o motivo e a ação "Corrigir" na própria linha/cartão.

---

## 4. Tipografia

Uma família, carregada por **`next/font`** (DM Sans), exposta como `--font-sans`; nenhuma
`@import` de fonte externa nem fonte do sistema espalhada nos módulos.

```
32px / 600  → título de página (h1)
24px / 700  → título de card de login / de modal
18px / 600  → título de seção ("Pendências", "Histórico")
15px / 400  → corpo, inputs, botão primário
14px / 400  → subtítulos, links, linhas de tabela
13px / 500  → labels, badges, botões secundários
12px / 500  → hints, metadados (data, categoria)
```

---

## 5. Layout dos dashboards

```
┌──────────────────────────────────────────────────┐
│ TOPBAR  [Cert Manager]  [Título]   [Conta ▾]     │  --accent sólido, texto branco
└──────────────────────────────────────────────────┘
│   SIDEBAR    │            CONTEÚDO               │
│   280px      │   max-width ~1100px               │
│   --bg-sidebar│   padding: spacing × 3           │
```

- **Shell persistente:** topbar + sidebar renderizados **uma vez** no `layout.tsx` de cada papel
  e **não sofrem unmount** ao navegar. Aluno e coordenação **compartilham** o mesmo componente
  `DashboardShell` (muda o menu, não o código).
- **Aluno:** sidebar curta (Meus certificados) — ou só topbar se houver uma única tela.
- **Coordenação:** sidebar com **Análise** e **Configurar atividades**; o botão "⚙️ Configurar
  Atividades" solto no topo da lista de alunos vira item de menu.
- **Menu da conta:** "Sair" fica no menu da conta, **longe dos destinos** de navegação.
- Breakpoint **968px**: abaixo, sidebar vira *drawer* com hamburger (44×44 px); **480px**:
  espaçamento comprimido. **Ao criar tela nova, use só 968 e 480.**

---

## 6. Componentes compartilhados (`components/`)

| Componente | Função | Substitui |
|---|---|---|
| `Toast` (`useToast`) | Feedback `success`/`error`/`info`, canto inferior direito | `alert()` |
| `Modal` | Diálogo acessível: foco preso, `Esc` fecha, `aria-modal`, rolagem travada | `modalOverlay` copiado em 2 telas |
| `ConfirmDialog` | Confirmação de ação irreversível, com texto claro | `confirm()` |
| `PromptDialog`/campo de motivo | Motivo obrigatório da rejeição, dentro de um modal | `prompt()` |
| `StatusBadge` | §3 | `styles[cert.status]` e ternárias |
| `ProgressBar` | Horas aprovadas / carga total (`role="progressbar"`, `aria-valuenow`) | barras duplicadas em 2 telas |
| `CertificateCard` | Cartão de certificado (aluno e coordenação, variações por prop) | `.card` / `CertCard` |
| `Icones` | SVG desenhados no repositório | emojis |
| `Skeleton` | Carregamento na geometria do conteúdo | "Carregando…" |
| `EmptyState` | Ausência de dados com explicação e ação | `<p>Nenhum histórico.</p>` |

**Regra:** quando uma tela deixa de pertencer a um papel só, ela sai da pasta daquele painel e
vai para `components/`. O custo de compartilhar: o que não for recortado por papel **vaza**
(ações de aprovar não aparecem para o aluno) — recorte por prop/papel, nunca duplique a tela.

---

## 7. Campo de formulário tem borda própria

A borda de um card separa blocos e pode ser quase invisível; a do input precisa **anunciar que
ali se digita**. Por isso os tokens `--input-*` são próprios (não `--border`). Foco: borda
`--accent` + anel de 3px `--input-ring` + fundo branco. Checkbox/radio ficam de fora do hover
global. Escolha **exclusiva** é radio/select, nunca caixa de seleção; **liga/desliga** (ex.
"Ativo") é checkbox/switch com rótulo clicável.

- Todo `<input>` tem `<label htmlFor>` associado (hoje os `label` estão soltos).
- Erro de validação aparece **junto ao campo** (`aria-describedby`), não em `alert()`.
- `.form-hint` (12px, `--text-muted`) conta o que o campo não diz sozinho (ex.: "PDF ou imagem,
  até 5 MB").
- Mensagens de erro de negócio em português; nunca `error.message` cru do Supabase.

---

## 8. Telas

### 8.1 Login
Palco escuro + `auth-card` branco (max 420px, padding 40px, `fadeInUp`). Campos e-mail/senha,
botão `btn-primary` full-width com `spinner` durante o envio, erro em `alert-error` (fundo a 6%
da cor, borda a 20%). Marca em destaque no topo. Link de "esqueci a senha" quando existir.

### 8.2 Aluno — "Meus certificados"
- Cabeçalho: título + **cartão de progresso** (`ProgressBar` "X / 120 h aprovadas").
- Ação primária **"+ Novo certificado"** (abre `Modal`).
- Lista de `CertificateCard`: título, categoria, horas, `StatusBadge`, link "Ver arquivo".
  Rejeitado → bloco de motivo + botão **Corrigir** (abre o mesmo modal em modo edição).
- Ordenado do mais recente; **agrupar ou filtrar por status** (abas: Todos · Em análise ·
  Aprovados · Rejeitados) quando houver volume.
- **Modal de envio:** Tipo de atividade (select) → ao escolher, **mostra a regra** (mínimo, teto,
  comprovante exigido) *antes* de preencher; Título; Horas (com validação contra mín/teto);
  Arquivo (com tipo/tamanho permitidos). Em edição: "Deixe vazio para manter o atual".
- Estados: carregando (`Skeleton`), vazio (`EmptyState` "Você ainda não enviou certificados").

### 8.3 Coordenação — Análise
- **Master–detail:** lista de alunos à esquerda (busca + ordenação por pendências, badge com
  contagem), detalhe do aluno à direita. Selecionado indicado também por texto/`aria-current`,
  não só cor.
- Cabeçalho do aluno: avatar (inicial), nome, e-mail, `ProgressBar` de horas.
- Duas seções: **Pendências (requer atenção)** e **Histórico**. Pendência mostra a
  **regra oficial** ao lado (mínimo, teto, comprovante) e alerta **"Abaixo do mínimo"** /
  **"Acima do teto"** em `--warning`.
- **Aprovar:** `ConfirmDialog`. **Rejeitar:** modal com **motivo obrigatório**; o motivo vira
  entrada do histórico de correções (data + autor), mostrado do mais recente ao mais antigo.
- **Decisão irreversível não cabe num botão solto** — sempre passa por confirmação, e o resultado
  aparece em `Toast`.
- Ato feito por alguém se identifica: "Aprovado por <nome> em <data>".
- Mobile: master–detail vira navegação em duas telas (lista → detalhe, com "← Voltar").

### 8.4 Coordenação — Configurar atividades
- Seletor de **curso** + botão "Novo curso" (abre `Modal`, **não** `prompt()`).
- Tabela de regras: Eixo (tag), Atividade, Mínimo, Teto, Comprovante, Status
  (Ativo/Inativo), Ações. Inativo = linha esmaecida **e** rótulo "Inativo".
- **Excluir** regra: `ConfirmDialog` explicando a consequência; se houver certificados
  vinculados, o botão oferece **Inativar** em vez de excluir. Ação destrutiva usa `--danger`.
- Voltar para a coordenação por item de menu/breadcrumb, não por um link solto.
- Em ≤968px a tabela vira lista de cartões (sem rolagem horizontal).

---

## 9. Princípios de UX registrados

- **Uma ação que não cabe na tela é uma ação que não existe** — toda ação disponível em desktop
  tem caminho em 360px.
- **Recusa muda é lida como tela quebrada** — quando algo está bloqueado, diga **por quê**
  (ex.: "Corrija o certificado rejeitado para reenviar").
- **Dado que não se edita continua visível, e diz por que** (ex.: certificado aprovado aparece
  travado: "Aprovado — não pode ser alterado").
- **Feedback < 100 ms** em todo clique; skeleton na mesma geometria; sem layout shift.
- **Ícone é SVG desenhado no repositório, nunca emoji.** Ícone acompanha texto; sozinho exige
  `aria-label`.
- **Foco visível** (`:focus-visible`) em tudo; alvo de toque ≥ 44×44 px; contraste de texto ≥
  4,5:1.
- **Datas em `pt-BR`** (`dd/mm/aaaa`), formatadas por um helper único (`lib/datas`), nunca
  `toLocaleDateString()` solto; fuso `America/Sao_Paulo`.

---

## 10. Espaçamento, raios, sombras, animações

**Base `--spacing: 8px`** → 8 (gaps) · 12 · 16 (seções) · 24 (cards) · 32 (margens) · 40
(auth-card). **Raios:** 8 botão · 12 padrão · 16 cards grandes · 50% avatar · 999px pills.
**Animações:** `fadeInUp` 0.5s (entrada do card), `slideUp` (toast), `slideDown` (alertas),
`spin` (spinner), `orbFloat` 25s (orbs). Transições de hover `0.2s ease`. Respeitar
`prefers-reduced-motion`.

---

## 11. Arquivos de estilo (alvo)

```
app/globals.css                 ← tokens do :root, reset, componentes globais, anti-flash
components/<Nome>/<Nome>.module.css   ← um módulo por componente compartilhado
app/<rota>/*.module.css         ← só o que é específico da rota
```
CSS Modules por componente, **sem hardcode de cor**; Tailwind: decidir (usar de fato ou remover
a dependência — hoje está instalado e ignorado).

## 12. Dívida de design

> **Status (2026-10-13):** itens 1–9 abaixo foram **implementados** (tokens, classes, Toast/ConfirmDialog, SVG, `Modal`, `htmlFor`, `DashboardShell`, `next/font`, home). **Falta validar visualmente** (contraste, mobile) e conferir o que a coordenação percebe na prática.

Lista original:

1. Tokens inexistentes → centralizar no `:root` (§2).
2. Cores e *inline styles* em JSX (`style={{background:'#2563eb'}}` etc.) → classes/tokens.
3. `alert`/`confirm`/`prompt` → `Toast`/`ConfirmDialog`/modal com motivo.
4. Emojis → `Icones` SVG.
5. Modais duplicados e sem acessibilidade → `Modal` único.
6. `label` sem `htmlFor`; status exibido em inglês cru (`cert.status`).
7. `height: 100vh` + sidebar fixa na coordenação sem versão mobile → `DashboardShell` responsivo.
8. Fonte do sistema/Arial → `next/font`.
9. `app/page.tsx` ainda é a página-template do Next → home real ou redirect para `/login`.
