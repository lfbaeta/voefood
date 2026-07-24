# Cloudflare Worker — Subdomain Proxy

Este Worker resolve a limitação da hospedagem Lovable que redireciona
subdomínios secundários (`{slug}.peddi.online`) para o domínio primário
(`peddi.online`), impedindo o roteamento multi-tenant por subdomínio.

## O que faz

Recebe requisições em `*.peddi.online`, faz proxy transparente para a origem
Lovable enviando `Host: peddi.online`, e devolve a resposta ao navegador
mantendo a URL original do subdomínio. O app React lê
`window.location.hostname` para identificar o restaurante — nenhuma mudança
de código é necessária.

## Deploy passo a passo

### 1. Criar o Worker
1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Create Worker**
2. Dê um nome (ex.: `peddi-subdomain-proxy`) e clique **Deploy**
3. Clique **Edit code**, apague o boilerplate e cole o conteúdo de
   [`subdomain-proxy.js`](./subdomain-proxy.js)
4. **Save and deploy**

### 2. Configurar a rota (Trigger)
1. No Worker, aba **Settings** → **Triggers** → **Add route**
2. Preencha:
   - **Route:** `*.peddi.online/*`
   - **Zone:** `peddi.online`
3. Salve

> Não adicione a rota `peddi.online/*` — o domínio raiz já funciona
> normalmente pela Lovable.

### 3. DNS
- O wildcard `*.peddi.online` no Cloudflare deve estar **Proxied**
  (nuvem laranja 🟠), não DNS-only. Sem o proxy, o Worker não é acionado.
- Confirme que o registro aponta para o IP da Lovable (`185.158.133.1`) ou
  para o CNAME de verificação, conforme já configurado.

### 4. Registro do domínio no Lovable
- Apenas `peddi.online` (primário) precisa estar registrado em
  **Project Settings → Domains** no Lovable.
- Você **não precisa** registrar cada subdomínio individualmente — o Worker
  cuida disso.

## Testando

Após deploy, acesse `https://restaurante-seu-ze.peddi.online/admin`:
- A URL no navegador **permanece** com o subdomínio (sem redirect para `peddi.online/admin`)
- O app carrega e `getSubdomain()` retorna `restaurante-seu-ze`
- O admin renderiza normalmente

Se precisar depurar, o Worker inclui os headers:
- `X-Forwarded-Host`: subdomínio original
- `X-Peddi-Subdomain`: slug extraído

## Subdomínios reservados

O Worker ignora subdomínios técnicos (`www`, `api`, `admin`, `mail`, `docs`,
etc.) — eles passam direto sem proxy. Edite a lista `RESERVED_SUBDOMAINS`
no script se precisar adicionar/remover algum.
