# Cert Manager IFET

Gerenciador de certificados de atividades complementares — Next.js 16 + Supabase.
O aluno envia certificados; a coordenação aprova ou rejeita (com motivo) e acompanha as horas.

## Rodar

```bash
cp .env.example .env.local   # preencha com as chaves do projeto Supabase
npm install
npm run dev                  # http://localhost:3000
npm run lint && npx tsc --noEmit && npm run build
```

## Estrutura

```
app/                  rotas (Server Components por padrão; ilhas client em _components/)
proxy.ts              gate de sessão e papel (Next 16; antigo middleware)
components/           UI compartilhada (Shell, Modal, Toast, StatusBadge…)
lib/services/         ÚNICO lugar que fala com o Supabase (Adapter → DTOs de lib/types.ts)
lib/supabase/         clientes browser/servidor (@supabase/ssr, sessão em cookie)
supabase/proposals/   SQL proposto, ainda não aplicado
spec/                 doutrina: arch, performance, design, deploy + promptContexto
```

Leia `spec/` antes de mexer: `arch.md`, `performance.md`, `design.md`, `deploy.md`.
`spec/promptContexto.md` descreve o estado real e as pendências.
