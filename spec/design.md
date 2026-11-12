# Design — Cert Manager IFET

Referência do design system do **sistema de certificados**. Define o **alvo** de UI para as
telas existentes (login, painel do aluno, painel da coordenação, configuração de atividades).

> **Documentos-irmãos:** `promptContexto.md` (estado real), `arch.md`, `performance.md`.
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
--text-primary:     #1A1A1A;   --text-secondary: #6B7280;  --text-muted: #5B6470;
--border:           #E5E7EB;

/* semânticos — um significado por cor */
--success: #2D6A4F;  --warning: #8A5300;  --danger: #B91C1C;  --info: #1D4ED8;

/* eixos de atividades (identidade verde-floresta complementar) */
--axis-tecnologico: #2D6A4F;  --axis-tecnologico-bg: rgba(45, 106, 79, 0.12);
--axis-integrador:  #40916C;  --axis-integrador-bg:  rgba(64, 145, 108, 0.14);
--axis-basico:      #6F8F72;  --axis-basico-bg:      rgba(111, 143, 114, 0.16);

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
> `warning` como vermelho de ação destrutiva. As cores dos eixos são variações botânicas da marca
> e nunca usam vermelho de erro/rejeição.

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
- **Aluno:** sidebar com "Meus certificados" e "Regras de atividades".
- **Coordenação:** sidebar com **Análise** e **Configurar atividades**.
- Breakpoint **968px**: abaixo, sidebar vira *drawer* com hamburger (44×44 px); **480px**:
  espaçamento comprimido.

---

## 6. Componentes compartilhados (`components/`)

| Componente | Função |
|---|---|
| `Toast` (`useToast`) | Feedback `success`/`error`/`info`, canto inferior direito |
| `Modal` | Diálogo acessível: foco preso, `Esc` fecha, `aria-modal`, rolagem travada |
| `ConfirmDialog` | Confirmação de ação irreversível, com texto claro e cálculo de horas |
| `StatusBadge` | Badges de situação dos certificados |
| `ProgressBar` | Barra horizontal segmentada por eixo, proporcional à carga exigida, com legenda interativa e horas reservadas |
| `FilterBar` | Barra unificada com busca textual, filtro de eixos, tipos de atividades e situação com contadores |
| `CertificateCard` | Cartão de certificado com tags de eixo, horas declaradas vs reconhecidas e alertas |
| `Icones` | SVGs próprios centralizados no repositório |
| `Skeleton` | Carregamento na geometria do conteúdo |
| `EmptyState` | Ausência de dados com explicação e ação |

---

## 7. Formulários e Regras de Horas

- Todo `<input>` tem `<label htmlFor>` associado.
- Resumo dinâmico da regra ao selecionar a atividade: eixo, mínimo, teto por certificado, comprovante e saldo da cota (se houver).
- **Horas abaixo do mínimo:** aviso informativo claro (`IconInfo`), sem bloquear o envio do formulário.
- **Horas acima do teto/cota:** cálculo antecipado de horas aproveitáveis vs excedentes desconsideradas (`IconWarning`), permitindo envio.
- **Quota esgotada:** bloqueio explícito da atividade com aviso impeditivo antes do envio.

---

## 8. Telas

### 8.1 Login
Palco escuro + `auth-card` branco.

### 8.2 Aluno — "Meus certificados"
- Indicadores agregados no topo (aprovados com horas reconhecidas, em análise com horas reservadas, rejeitados).
- Barra de progresso segmentada por eixo com legenda clicável para filtrar.
- Barra combinada de filtros (`FilterBar`).
- Lista de certificados filtrada com `CertificateCard`.

### 8.3 Coordenação — Análise
- Master–detail: lista de alunos com busca e abas de pendências.
- Detalhe do aluno selecionado com `ProgressBar` segmentada e `FilterBar` completa.
- Diálogo de aprovação informando com clareza as horas declaradas e as horas que serão creditadas.

### 8.4 Coordenação — Configurar atividades
- CRUD de regras com indicação de eixos, tetos individuais e acumulados.
