import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Cloud,
  Terminal,
  Globe,
  Code2,
  Wrench,
  Check,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Link2,
} from 'lucide-react';

/** Seções de infraestrutura expostas na sidebar da documentação. */
export const infraGuideSections = [
  { id: 'infra-visao', label: '30. Hospedagem no Lovable', icon: Cloud },
  { id: 'infra-publicar', label: '31. Publicar e Conectar Domínio', icon: Link2 },
  { id: 'infra-cloudflare', label: '32. Cloudflare: DNS e SSL', icon: Globe },
  { id: 'infra-worker', label: '33. Worker de Subdomínio (código)', icon: Code2 },
  { id: 'infra-atualizacoes', label: '34. Atualizações e Manutenção', icon: Wrench },
];

function Tip({ type = 'info', title, children }: { type?: 'info' | 'warning' | 'success'; title: string; children: ReactNode }) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
    warning: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
    success: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
  };
  const icons = {
    info: <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
    success: <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
  };
  return (
    <div className={cn('rounded-lg border p-4 my-4', styles[type])}>
      <div className="flex items-start gap-3">
        {icons[type]}
        <div>
          <p className="font-semibold text-sm mb-1">{title}</p>
          <div className="text-sm text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Steps({ items }: { items: { title: string; description: ReactNode }[] }) {
  return (
    <div className="my-4">
      {items.map((item, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
              {i + 1}
            </div>
            {i < items.length - 1 && <div className="w-0.5 h-full bg-border mt-2" />}
          </div>
          <div className={cn('flex-1', i < items.length - 1 ? 'pb-6' : 'pb-0')}>
            <h4 className="font-semibold text-foreground mb-1 text-sm">{item.title}</h4>
            <div className="text-sm text-muted-foreground">{item.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Checks({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 my-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
          <span className="text-muted-foreground">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Fields({ rows, head = 'Campo / Opção' }: { rows: [string, string][]; head?: string }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border rounded-lg overflow-hidden">
        <thead className="bg-muted">
          <tr>
            <th className="text-left py-2 px-3 font-medium w-1/3">{head}</th>
            <th className="text-left py-2 px-3 font-medium">Detalhe</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([field, desc], i) => (
            <tr key={i} className="border-t">
              <td className="py-2 px-3 font-medium align-top">{field}</td>
              <td className="py-2 px-3 text-muted-foreground">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Path({ children }: { children: string }) {
  return <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium text-foreground">{children}</code>;
}

function Code({ title, children }: { title?: string; children: string }) {
  return (
    <div className="my-4 rounded-lg border overflow-hidden">
      {title && <div className="bg-muted px-3 py-1.5 text-xs font-medium flex items-center gap-2"><Terminal className="h-3.5 w-3.5" />{title}</div>}
      <pre className="bg-foreground/[0.04] p-3 overflow-x-auto text-xs leading-relaxed m-0">
        <code className="text-foreground whitespace-pre">{children}</code>
      </pre>
    </div>
  );
}

function DocSection({
  id,
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{title}</CardTitle>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">{children}</CardContent>
      </Card>
    </section>
  );
}

const WORKER_CODE = `/**
 * Cloudflare Worker — Subdomain Proxy
 *
 * Faz proxy transparente de https://{slug}.seudominio.com/*
 * para a origem hospedada no Lovable (seudominio.com), sem redirecionar.
 * O navegador continua exibindo o subdomínio e o app identifica
 * o restaurante por window.location.hostname.
 */

const ORIGIN_HOST = "seudominio.com"; // domínio primário conectado no Lovable

// Subdomínios que NÃO representam restaurantes (passam direto)
const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "admin",
  "app",
  "mail",
  "email",
  "ftp",
  "cdn",
  "assets",
  "static",
  "docs",
  "blog",
  "status",
  "lp",
]);

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Domínio raiz → repassa sem alterações
    if (hostname === ORIGIN_HOST) {
      return fetch(request);
    }

    const parts = hostname.split(".");
    const subdomain = parts.length > 2 ? parts[0] : null;

    // Subdomínio reservado ou inexistente → passa direto
    if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain.toLowerCase())) {
      return fetch(request);
    }

    // Aponta a requisição para o domínio primário
    const originUrl = new URL(request.url);
    originUrl.hostname = ORIGIN_HOST;

    const headers = new Headers(request.headers);
    headers.set("Host", ORIGIN_HOST);
    headers.set("X-Forwarded-Host", hostname);   // debug/logs
    headers.set("X-Peddi-Subdomain", subdomain); // debug/logs

    const proxied = new Request(originUrl.toString(), {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
      redirect: "manual", // não seguir redirect da hospedagem
    });

    let response = await fetch(proxied);

    // Reescreve redirects para manter o usuário no subdomínio
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (location) {
        try {
          const locUrl = new URL(location, originUrl);
          if (locUrl.hostname === ORIGIN_HOST) {
            locUrl.hostname = hostname;
            const newHeaders = new Headers(response.headers);
            newHeaders.set("Location", locUrl.toString());
            response = new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: newHeaders,
            });
          }
        } catch {
          // Location relativo ou inválido → ignora
        }
      }
    }

    return response;
  },
};`;

export function InfraGuideSections() {
  return (
    <>
      {/* 30 - Hospedagem no Lovable */}
      <DocSection
        id="infra-visao"
        icon={Cloud}
        title="30. Hospedagem no Lovable"
        subtitle="Como o sistema roda e o que você precisa configurar"
      >
        <p>
          O sistema é hospedado <strong>inteiramente no Lovable</strong>. O <strong>frontend</strong> (aplicação
          React) é publicado na hospedagem do Lovable e o <strong>backend</strong> (banco de dados, autenticação,
          storage, edge functions e segredos) roda no <strong>Lovable Cloud</strong>. Não existe servidor para
          instalar, nem Node, Nginx ou banco de dados para manter.
        </p>

        <Fields
          head="Componente"
          rows={[
            ['Frontend (app React)', 'Publicado pelo botão Publish do Lovable. CDN global, HTTPS automático e domínio próprio inclusos.'],
            ['Backend (Lovable Cloud)', 'Banco de dados, login, arquivos, edge functions e segredos. Atualiza imediatamente, sem publicar.'],
            ['Domínio próprio', 'Conectado em Configurações do Projeto → Domínios. SSL emitido automaticamente.'],
            ['Subdomínio por restaurante', 'Resolvido pelo Cloudflare Worker (seções 32 e 33): pizzaria.seudominio.com abre o cardápio daquele estabelecimento.'],
          ]}
        />

        <Tip type="success" title="Nada para administrar">
          Sem servidor, sem SSH, sem atualização de sistema operacional e sem renovação manual de certificado.
          Backups, escala e monitoramento ficam por conta da infraestrutura do Lovable.
        </Tip>

        <Tip type="info" title="Frontend x Backend na hora de publicar">
          Mudanças de backend (banco, funções, políticas) entram no ar na hora. Mudanças visuais e de código do
          app só aparecem no endereço público depois de clicar em <strong>Publish → Update</strong>.
        </Tip>
      </DocSection>

      {/* 31 - Publicar e conectar domínio */}
      <DocSection
        id="infra-publicar"
        icon={Link2}
        title="31. Publicar o App e Conectar o Domínio"
        subtitle="Do primeiro publish ao domínio próprio no ar"
      >
        <Steps
          items={[
            {
              title: 'Publique o projeto',
              description: (
                <>
                  Clique em <strong>Publish</strong> (canto superior direito). Na primeira vez é criado o endereço{' '}
                  <Path>seuprojeto.lovable.app</Path>. Use esse endereço para validar tudo antes do domínio próprio.
                </>
              ),
            },
            {
              title: 'Abra as configurações de domínio',
              description: (
                <>
                  Vá em <Path>Project Settings → Domains</Path> (ou <strong>Publish → Add custom domain</strong>) e
                  clique em <strong>Connect Domain</strong>.
                </>
              ),
            },
            {
              title: 'Informe o domínio raiz e o www',
              description: (
                <>
                  Cadastre <Path>seudominio.com</Path> e também <Path>www.seudominio.com</Path> — o www não é
                  adicionado sozinho. Escolha qual será o <strong>Primary</strong>; o outro passa a redirecionar.
                </>
              ),
            },
            {
              title: 'Copie os registros DNS exibidos',
              description: (
                <>
                  A tela mostra um registro <strong>A</strong> apontando para <Path>185.158.133.1</Path> e um{' '}
                  <strong>TXT</strong> <Path>_lovable</Path> de verificação. Eles serão criados no Cloudflare na
                  próxima seção.
                </>
              ),
            },
            {
              title: 'Aguarde verificação e SSL',
              description:
                'O status passa por Verifying → Setting up → Active. A propagação costuma levar minutos, podendo chegar a 72h. O certificado HTTPS é emitido automaticamente.',
            },
          ]}
        />

        <Fields
          head="Status do domínio"
          rows={[
            ['Verifying', 'Aguardando propagação do DNS para confirmar a titularidade.'],
            ['Setting up', 'Titularidade confirmada; emitindo o certificado SSL.'],
            ['Ready', 'DNS correto, mas o projeto ainda não foi publicado. Clique em Publish.'],
            ['Active', 'Domínio no ar, servindo o app com HTTPS.'],
            ['Offline / Failed', 'DNS deixou de apontar para o Lovable ou o SSL falhou. Revise os registros e use Retry.'],
          ]}
        />

        <Tip type="warning" title="Publique antes de conectar">
          O domínio só pode ser conectado depois do primeiro publish. Se conectar antes, ele fica no status
          <strong> Ready</strong> até você publicar.
        </Tip>
      </DocSection>

      {/* 32 - Cloudflare */}
      <DocSection
        id="infra-cloudflare"
        icon={Globe}
        title="32. Cloudflare: DNS, Wildcard e SSL"
        subtitle="Configuração completa da zona para funcionar com o Lovable"
      >
        <p>
          O Cloudflare é necessário por dois motivos: gerenciar o DNS do domínio apontando para a hospedagem do
          Lovable e permitir o <strong>subdomínio por restaurante</strong> através do Worker (seção 33).
        </p>

        <h4>Etapa 1 — Adicionar o domínio no Cloudflare</h4>
        <Steps
          items={[
            { title: 'Crie a conta e adicione o site', description: <>Painel Cloudflare → <strong>Add a site</strong> → digite <Path>seudominio.com</Path> → escolha o plano <strong>Free</strong>.</> },
            { title: 'Troque os nameservers no registrador', description: 'No Registro.br, GoDaddy, Hostinger, Namecheap etc., substitua os nameservers atuais pelos dois indicados pela Cloudflare. Remova quaisquer nameservers antigos.' },
            { title: 'Aguarde a zona ficar Active', description: 'A propagação leva de alguns minutos a algumas horas. Só siga adiante quando o status da zona for "Active".' },
            { title: 'Limpe registros herdados', description: 'Ao importar o DNS, a Cloudflare copia registros antigos. Apague registros A/CNAME do domínio raiz e do www que apontem para hospedagens anteriores — eles causam conflito.' },
          ]}
        />

        <h4>Etapa 2 — Criar os registros DNS</h4>
        <p>
          Em <Path>DNS → Records</Path>, deixe exatamente estes registros (o valor <Path>185.158.133.1</Path> é o IP
          da hospedagem do Lovable):
        </p>
        <Fields
          head="Registro"
          rows={[
            ['A · @ · 185.158.133.1 · Proxied', 'Domínio raiz apontando para a hospedagem do Lovable.'],
            ['A · www · 185.158.133.1 · Proxied', 'Endereço com www. Cadastre também em Project Settings → Domains.'],
            ['A · * · 185.158.133.1 · Proxied', 'Wildcard: habilita qualquer subdomínio de restaurante. Precisa estar Proxied (nuvem laranja) — sem o proxy o Worker não é acionado.'],
            ['TXT · _lovable · valor da tela de Domains · DNS only', 'Verificação de titularidade exigida pelo Lovable. Não use proxy em registros TXT.'],
            ['CNAME · lp · destino externo · conforme o provedor', 'Opcional: subdomínio reservado para a landing page externa. Já consta na lista de reservados do Worker.'],
          ]}
        />

        <Tip type="warning" title="Wildcard precisa estar Proxied">
          Se o registro <Path>*</Path> ficar em <strong>DNS only</strong> (nuvem cinza), a requisição não passa pela
          borda da Cloudflare, o Worker nunca roda e o subdomínio do restaurante é redirecionado para o domínio raiz.
        </Tip>

        <h4>Etapa 3 — SSL/TLS e segurança</h4>
        <Fields
          head="Configuração"
          rows={[
            ['SSL/TLS → Overview → Full', 'Modo de criptografia. Use Full (não use Flexible: gera loop de redirecionamento).'],
            ['Edge Certificates → Always Use HTTPS: ON', 'Força todo o tráfego para HTTPS.'],
            ['Edge Certificates → Automatic HTTPS Rewrites: ON', 'Evita aviso de conteúdo misto.'],
            ['Edge Certificates → Universal SSL', 'Cobre seudominio.com e *.seudominio.com automaticamente no plano Free.'],
            ['Security → Bot Fight Mode: OFF', 'Ligado, pode bloquear webhooks de pagamento e do WhatsApp.'],
            ['Speed → Brotli: ON', 'Compressão dos arquivos do app. Não ative minificação de HTML/JS: o build já vem minificado.'],
          ]}
        />

        <Tip type="info" title="Cache">
          Deixe o cache padrão. Se após uma publicação o app não atualizar, use{' '}
          <Path>Caching → Configuration → Purge Everything</Path> ou ligue o <strong>Development Mode</strong> por 3
          horas enquanto faz testes.
        </Tip>

        <Checks
          items={[
            'Zona com status Active e nameservers propagados',
            'Registros A de @, www e * apontando para 185.158.133.1 em modo Proxied',
            'TXT _lovable criado em DNS only',
            'Domínio em Project Settings → Domains com status Active',
            'https://seudominio.com abre o app com cadeado',
          ]}
        />
      </DocSection>

      {/* 33 - Worker */}
      <DocSection
        id="infra-worker"
        icon={Code2}
        title="33. Cloudflare Worker: Subdomínio por Restaurante"
        subtitle="Passo a passo do deploy e código completo do Worker"
      >
        <p>
          Cada restaurante tem seu próprio endereço (<Path>pizzaria.seudominio.com</Path>). Como a hospedagem do
          Lovable serve apenas o domínio principal e redireciona os demais, um <strong>Cloudflare Worker</strong>{' '}
          faz o proxy transparente: a requisição chega no subdomínio, é encaminhada para o domínio principal e a
          resposta volta <em>sem alterar a URL do navegador</em>. O app então lê o hostname e carrega o restaurante
          correspondente.
        </p>

        <h4>Passo a passo</h4>
        <Steps
          items={[
            {
              title: 'Crie o Worker',
              description: (
                <>
                  Cloudflare → <strong>Workers &amp; Pages</strong> → <strong>Create</strong> →{' '}
                  <strong>Start with Hello World</strong> → nome sugerido <Path>peddi-subdomain-proxy</Path> →{' '}
                  <strong>Deploy</strong>.
                </>
              ),
            },
            {
              title: 'Cole o código',
              description: (
                <>
                  Clique em <strong>Edit code</strong>, apague o exemplo e cole o código completo listado abaixo
                  (também disponível no projeto em <Path>cloudflare-worker/subdomain-proxy.js</Path>).
                </>
              ),
            },
            {
              title: 'Ajuste o ORIGIN_HOST',
              description: (
                <>
                  Na constante <Path>ORIGIN_HOST</Path>, coloque exatamente o domínio primário conectado no Lovable
                  (ex.: <Path>seudominio.com</Path>, sem https e sem barra final).
                </>
              ),
            },
            {
              title: 'Revise os subdomínios reservados',
              description: (
                <>
                  A lista <Path>RESERVED_SUBDOMAINS</Path> passa direto, sem proxy. Mantenha www, api, admin, docs,
                  lp e acrescente qualquer subdomínio técnico que você use (ex.: <Path>mkt</Path>,{' '}
                  <Path>suporte</Path>). Nunca use um desses nomes como subdomínio de restaurante.
                </>
              ),
            },
            {
              title: 'Faça o deploy',
              description: <>Clique em <strong>Deploy</strong> no editor. O Worker fica disponível imediatamente.</>,
            },
            {
              title: 'Adicione a rota (trigger)',
              description: (
                <>
                  Aba <strong>Settings → Domains &amp; Routes → Add → Route</strong>. Route:{' '}
                  <Path>*.seudominio.com/*</Path> — Zone: <Path>seudominio.com</Path>. <strong>Não</strong> cadastre{' '}
                  <Path>seudominio.com/*</Path>: a raiz já funciona direto e a rota extra causa loop.
                </>
              ),
            },
            {
              title: 'Cadastre o subdomínio no restaurante',
              description: (
                <>
                  No painel do revendedor, o campo de subdomínio do estabelecimento define o endereço. Ex.:
                  subdomínio <Path>pizzaria-do-joao</Path> → <Path>pizzaria-do-joao.seudominio.com</Path>.
                </>
              ),
            },
          ]}
        />

        <h4>Código completo do Worker</h4>
        <Code title="subdomain-proxy.js — cole no editor do Cloudflare Worker">{WORKER_CODE}</Code>

        <Tip type="info" title="Deploy pela linha de comando (opcional)">
          Quem preferir o Wrangler pode usar o arquivo do projeto diretamente.
        </Tip>
        <Code title="wrangler.toml">{`name = "peddi-subdomain-proxy"
main = "cloudflare-worker/subdomain-proxy.js"
compatibility_date = "2024-11-01"

[[routes]]
pattern = "*.seudominio.com/*"
zone_name = "seudominio.com"`}</Code>
        <Code title="terminal">{`npx wrangler login
npx wrangler deploy`}</Code>

        <h4>Como testar</h4>
        <Steps
          items={[
            { title: 'Abra um subdomínio real', description: <>Ex.: <Path>https://pizzaria-do-joao.seudominio.com</Path>. A URL deve permanecer no subdomínio, sem redirecionar para a raiz.</> },
            { title: 'Confira o cardápio', description: 'Deve carregar o cardápio daquele restaurante, com logo, cores e produtos próprios.' },
            { title: 'Teste o painel e o checkout', description: <>Acesse <Path>/admin</Path> no subdomínio, faça login e finalize um pedido de teste para validar rotas internas e pagamento.</> },
            { title: 'Veja os logs se algo falhar', description: <>Workers &amp; Pages → seu Worker → <strong>Logs</strong> → Begin log stream. Os headers <Path>X-Forwarded-Host</Path> e <Path>X-Peddi-Subdomain</Path> mostram o subdomínio detectado.</> },
          ]}
        />

        <h4>Problemas comuns</h4>
        <Fields
          head="Sintoma"
          rows={[
            ['Subdomínio redireciona para o domínio raiz', 'Rota do Worker ausente/incorreta ou wildcard em DNS only. Confira a rota *.seudominio.com/* e deixe o registro * Proxied.'],
            ['Loop de redirecionamento (ERR_TOO_MANY_REDIRECTS)', 'Existe rota do Worker para o domínio raiz ou o SSL está em Flexible. Remova a rota da raiz e use Full.'],
            ['Erro 1101 / Worker threw exception', 'ORIGIN_HOST digitado com https:// ou barra final. Use apenas o domínio.'],
            ['Erro 522 / 526', 'Origem indisponível ou modo SSL incorreto. Verifique se o projeto está publicado e o modo em Full.'],
            ['Página "Restaurante não encontrado"', 'O subdomínio cadastrado no estabelecimento não confere com o usado na URL.'],
            ['Alterações não aparecem', 'Cache: faça Purge Everything e confirme que clicou em Publish → Update no Lovable.'],
          ]}
        />

        <Checks
          items={[
            'Worker publicado com ORIGIN_HOST igual ao domínio primário',
            'Rota *.seudominio.com/* ativa na zona correta',
            'Nenhuma rota cadastrada para o domínio raiz',
            'Subdomínio de teste abrindo o cardápio certo sem mudar a URL',
            'Subdomínios reservados (www, docs, lp) continuam funcionando normalmente',
          ]}
        />
      </DocSection>

      {/* 34 - Atualizações */}
      <DocSection
        id="infra-atualizacoes"
        icon={Wrench}
        title="34. Atualizações, Backup e Manutenção"
        subtitle="Rotina de manutenção na hospedagem do Lovable"
      >
        <Fields
          head="Item"
          rows={[
            ['Atualização do frontend', 'Clique em Publish → Update. A nova versão entra no ar em segundos para todos os restaurantes ao mesmo tempo.'],
            ['Atualização do backend', 'Banco de dados, edge functions e políticas são aplicados imediatamente, sem necessidade de publicar.'],
            ['Backup dos dados', 'Feito pela infraestrutura do Lovable Cloud. Para uma cópia própria, use Cloud → Advanced settings → Export data.'],
            ['Certificado SSL', 'Renovação automática, tanto no Lovable quanto no Cloudflare.'],
            ['Capacidade', 'Se houver lentidão ou timeouts, aumente o tamanho da instância em Cloud → Overview → Advanced settings.'],
          ]}
        />

        <Checks
          items={[
            'Após cada publicação, teste o cardápio, um pedido e o painel admin em um subdomínio real',
            'Faça uma exportação periódica dos dados para guardar fora da plataforma',
            'Acompanhe o consumo do Cloud para dimensionar a instância antes de crescer',
            'Sempre que mudar o domínio, revise DNS, rota do Worker e o ORIGIN_HOST',
          ]}
        />

        <Tip type="warning" title="Chaves privadas nunca ficam no código">
          Credenciais de gateways de pagamento, certificados fiscais e tokens de API ficam apenas nos segredos do
          backend. Nunca coloque esses valores no código do app nem no Worker.
        </Tip>
      </DocSection>
    </>
  );
}
