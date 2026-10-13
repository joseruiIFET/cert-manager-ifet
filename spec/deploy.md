# Deploy — Cert Manager IFET

Como o sistema de certificados vai para o ar. O backend é o **Supabase (BaaS)**; a aplicação
Next.js é só o frontend. Portanto o deploy tem **duas metades independentes**: o **banco**
(migrations/RLS/Storage no Supabase) e o **app** (build do Next).

> ⚠️ **Decisão pendente:** onde hospedar o app Next.js — **Vercel** ou **servidor da escola**
> (container). A §2 descreve as duas opções; escolher uma e apagar a outra.
> Documentos-irmãos: `arch.md` §8 (migrations), `promptContexto.md` (estado real).

> **Estado (2026-10-13):** nenhuma mudança de banco foi aplicada pela refatoração; o app roda
> contra o schema existente. `supabase/migrations/` **ainda não existe** — o baseline
> (`supabase db pull`) é o primeiro passo da §4. Sessão agora em cookie: após o deploy, todos
> precisam entrar de novo uma vez.

## 1. Ambientes

| Ambiente | App | Supabase | Uso |
|---|---|---|---|
| **local** | `npm run dev` (`:3000`) | projeto **dev** ou stack local (`supabase start`) | desenvolvimento de cada um |
| **produção** | a definir (§2) | projeto **prod**, separado do dev | alunos e coordenação reais |

**Regra:** dev e produção são **projetos Supabase diferentes**, com chaves diferentes. Hoje há
um único projeto (`mjxqsgtzkdxmivufzjba`) — antes de ir para produção, criar o projeto de
produção e **não** reaproveitar dados de teste.

## 2. Hospedagem do app

### Opção A — Vercel (mais simples)
- Importar o repositório na Vercel; build `next build` automático a cada push.
- Variáveis em *Project → Settings → Environment Variables* (ver §3).
- Preview deploy por branch; produção pela `main`.
- Sem servidor para manter; HTTPS incluso (necessário para PWA/cookies `Secure`).

### Opção B — Servidor da escola (container)
Exige `output: 'standalone'` em `next.config.ts` e um `Dockerfile` (a criar na fase de ajuste).
```bash
git pull
docker compose --env-file .env.producao up -d --build
docker logs -f cert_manager_frontend
```
- **`--build` não é opcional:** `NEXT_PUBLIC_*` são **fixadas no build**; subir sem rebuild
  mantém as chaves antigas dentro do bundle.
- Atrás de nginx/proxy da TI com **HTTPS**; usar o **nome DNS**, não o IP.
- Nunca `down -v` num servidor em uso se houver volume (aqui não há banco local, mas vale o hábito).
- Se o servidor for compartilhado com outros projetos, conferir nome de container/porta antes.

## 3. Configuração (variáveis de ambiente)

| Variável | Onde vive | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | cliente + servidor | pública; assada no build |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente + servidor | pública **por desenho — a proteção é a RLS** |
| `SUPABASE_SERVICE_ROLE_KEY` | **somente servidor** | ignora RLS; **nunca** com prefixo `NEXT_PUBLIC_`, nunca no git |

- `.env.local` (dev) fica **fora do git** (`.gitignore`); manter um `.env.example` **sem valores
  reais** versionado.
- Segredos de produção moram no painel da Vercel / no `.env` do servidor com permissão restrita —
  **não versionar** (diferente de projetos em que a escola decidiu versionar). Se um segredo
  vazar no histórico do git, trocar no painel do Supabase (*Settings → API*).
- Cada ambiente com o **seu** par de chaves; produção nunca compartilha segredo com dev.

## 4. Banco: migrations (Supabase CLI, **não** Flyway)

**Flyway não é o caminho.** Funciona tecnicamente (basta apontar para a string de conexão
Postgres), mas precisa de JVM e não conhece `auth`, `storage` e RLS como parte do projeto. O
padrão do ecossistema é o **Supabase CLI**, e o **SQL Editor do painel não deve ser usado** para
mudar schema (a alteração não fica versionada e o próximo ambiente não a terá).

```
supabase/
  config.toml
  migrations/
    20261013120000_schema_inicial.sql      # tabelas, enums/checks, índices
    20261013120100_rls_policies.sql        # RLS de todas as tabelas
    20261013120200_storage_documents.sql   # bucket privado + policies de storage
    20261013120300_views_rpc.sql           # views/RPC de agregação
  seed.sql                                 # dados de dev
```

Fluxo de rotina:
```bash
supabase login
supabase link --project-ref <ref-do-projeto>

supabase migration new descricao          # cria o arquivo versionado
# edite o SQL; teste local:
supabase db reset                         # recria o local e roda migrations + seed
supabase db push                          # aplica as pendentes no projeto linkado
supabase migration list                   # o que está aplicado local x remoto
supabase gen types typescript --linked > lib/database.types.ts
```

- **Nunca edite migration já aplicada** — crie outra.
- **Schema e código na mesma alteração:** mudou coluna? migration + serviço/DTO no mesmo commit.
- **Baseline do que já existe:** o schema atual foi criado pelo painel. Antes de tudo:
  `supabase db pull` (gera a migration inicial a partir do banco real) e revisar — isso também
  revela as policies RLS hoje desconhecidas.
- **Produção:** aplicar com `supabase db push` contra o projeto de produção **antes** de publicar
  o app que depende da mudança (banco compatível primeiro, depois o código).

## 5. Deploy de rotina

1. `npm run lint && npx tsc --noEmit && npm run build` (local ou CI) — todos verdes.
2. Houve migration? `supabase db push` no projeto de produção; conferir `migration list`.
3. Publicar o app (Vercel: merge na `main`; servidor: §2-B).
4. **Verificação pós-deploy:** login de aluno e de coordenador; enviar um certificado; aprovar e
   rejeitar; abrir arquivo. Conferir logs no painel Supabase (*Logs → API/Postgres*).

## 6. Primeiro coordenador (bootstrap)

O cadastro público cria apenas **aluno**. O primeiro coordenador é criado manualmente:
1. Criar o usuário em *Authentication → Users* (ou convite).
2. Atualizar `profiles.role = 'coordinator'` **por migration/seed ou SQL controlado** — nunca
   deixando a policy permitir que o próprio usuário altere o `role`.
3. Depois, novos coordenadores são criados por Server Action de um coordenador existente.

## 7. Backup e recuperação

- Supabase faz backup diário nos planos pagos; no plano gratuito **não há** — exportar
  periodicamente: `supabase db dump -f backup.sql` (+ `--data-only` se preciso).
- **Storage não está no dump do banco:** copiar o bucket `documents` separadamente.
- Arquivos de backup contêm dados pessoais (alunos e certificados): **fora do git** e apagados
  quando não forem mais necessários.

## 8. Se der errado

| O que aparece | Causa provável | Saída |
|---|---|---|
| Tela carrega mas listas vêm vazias | RLS sem policy para o papel | revisar policies; testar logado como aluno/coordenador |
| `new row violates row-level security policy` | policy de INSERT/UPDATE faltando ou `with check` errado | corrigir por nova migration |
| `Invalid API key` / 401 no login | variáveis erradas ou do projeto errado | conferir `.env`/painel; **rebuild** (variáveis são assadas no build) |
| Funciona local, falha em produção | `NEXT_PUBLIC_*` não definidas no ambiente de build | definir e refazer o build |
| `supabase db push` reclama de histórico divergente | alteração feita direto no painel | `supabase db pull`, reconciliar, nova migration |
| Upload falha com 400/403 | policy do bucket ou tamanho/tipo | revisar `storage.objects` policies e limites do bucket |
| Link do arquivo expirou | *signed URL* vencida | gerar nova URL ao abrir |
| Redirect para `/login` em loop | cookie de sessão não persiste (HTTP, domínio) | usar HTTPS; conferir `middleware.ts` e domínio |
| Chave `service_role` apareceu no bundle | importada em arquivo cliente | remover, **rotacionar a chave** no painel |
