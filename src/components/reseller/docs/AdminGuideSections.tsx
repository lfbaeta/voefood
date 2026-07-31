import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Store,
  Palette,
  Layers,
  Package,
  List,
  Pizza,
  Clock,
  MapPin,
  Percent,
  ClipboardList,
  UtensilsCrossed,
  ChefHat,
  Users,
  Bike,
  Boxes,
  Printer,
  Receipt,
  Bot,
  Bell,
  BarChart3,
  Banknote,
  Smartphone,
  Check,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

/** Sections exposed to the docs sidebar (order matters). */
export const adminGuideSections = [
  { id: 'admin-acesso', label: '7. Acesso e Mapa do Painel', icon: Store },
  { id: 'admin-configuracoes', label: '8. Configurações da Loja', icon: Store },
  { id: 'admin-identidade', label: '9. Marca, Cores e Identidade', icon: Palette },
  { id: 'admin-cardapio', label: '10. Categorias e Produtos', icon: Layers },
  { id: 'admin-adicionais', label: '11. Acréscimos (Adicionais)', icon: List },
  { id: 'admin-pizzaria', label: '12. Módulo Pizzaria', icon: Pizza },
  { id: 'admin-horarios', label: '13. Horários e Fuso', icon: Clock },
  { id: 'admin-entrega', label: '14. Taxas de Entrega e Zonas', icon: MapPin },
  { id: 'admin-cupons', label: '15. Cupons e Promoções', icon: Percent },
  { id: 'admin-pagamentos', label: '16. Pagamentos (PIX, online, taxas)', icon: Banknote },
  { id: 'admin-pedidos', label: '17. Gestão de Pedidos', icon: ClipboardList },
  { id: 'admin-pdv', label: '18. PDV, Mesas e Balcão', icon: UtensilsCrossed },
  { id: 'admin-kds', label: '19. Cozinha e Bar (KDS)', icon: ChefHat },
  { id: 'admin-garcons', label: '20. Garçons', icon: Users },
  { id: 'admin-entregadores', label: '21. Entregadores e Rastreio', icon: Bike },
  { id: 'admin-estoque', label: '22. Estoque e Ficha Técnica', icon: Boxes },
  { id: 'admin-impressao', label: '23. Impressão Automática', icon: Printer },
  { id: 'admin-fiscal', label: '24. Fiscal / NFC-e', icon: Receipt },
  { id: 'admin-whatsapp', label: '25. WhatsApp e Agentes IA', icon: Bot },
  { id: 'admin-notificacoes', label: '26. Notificações e Push', icon: Bell },
  { id: 'admin-caixa', label: '27. Caixa e Relatórios', icon: BarChart3 },
  { id: 'admin-cliente', label: '28. Experiência do Cliente', icon: Smartphone },
  { id: 'admin-checklist', label: '29. Checklist de Go-Live', icon: CheckCircle2 },
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

function Fields({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border rounded-lg overflow-hidden">
        <thead className="bg-muted">
          <tr>
            <th className="text-left py-2 px-3 font-medium w-1/3">Campo / Opção</th>
            <th className="text-left py-2 px-3 font-medium">O que fazer</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([field, desc], i) => (
            <tr key={i} className="border-t">
              <td className="py-2 px-3 font-medium">{field}</td>
              <td className="py-2 px-3 text-muted-foreground">{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Path({ children }: { children: string }) {
  return (
    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium text-foreground">{children}</code>
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

export function AdminGuideSections() {
  return (
    <>
      {/* 7 */}
      <DocSection id="admin-acesso" icon={Store} title="7. Acesso e Mapa do Painel do Estabelecimento" subtitle="Onde fica exatamente cada funcionalidade">
        <p>
          Cada estabelecimento tem um painel próprio e isolado, acessado pelo <strong>subdomínio</strong> do
          estabelecimento: <Path>https://pizzaria-do-joao.peddi.online/admin</Path>. O cardápio público é o mesmo
          subdomínio sem <Path>/admin</Path>. O revendedor/superadmin entra em qualquer painel com o próprio login;
          o proprietário entra apenas no dele.
        </p>
        <Steps
          items={[
            { title: 'Abra a tela de login', description: <>Use <Path>https://subdominio.seudominio.com/auth</Path> (ou <Path>/auth</Path> no domínio principal, se você é revendedor).</> },
            { title: 'Informe e-mail e senha', description: 'São as credenciais criadas no cadastro do estabelecimento (aba Administradores, no painel do revendedor).' },
            { title: 'Você cai no Dashboard', description: 'Resumo do dia: faturamento, pedidos por status, ticket médio e itens mais vendidos.' },
          ]}
        />

        <h4 className="font-semibold mt-6 mb-2">Mapa do menu lateral (grupos reais do sistema)</h4>
        <Fields
          rows={[
            ['Operações', 'Dashboard, PDV, Caixa, Cozinha, Bar, Garçons, Acesso Garçons, Entregadores, Mapa Entregadores, Acesso Entregador.'],
            ['Gestão', 'Pedidos, Produtos, Categorias, Acréscimos, Cupons, Fiscal / NFC-e, Melhorar Fotos IA.'],
            ['Estoque', 'Insumos, Ficha Técnica, Compras, Fornecedores, Movimentações, Relatórios.'],
            ['Sistema', 'Taxas de Entrega, Horários, Impressão, Configurações.'],
            ['WhatsApp', 'Chat, Conexões, Agentes IA.'],
            ['Visualizar', 'Ver Cardápio — abre o cardápio público do estabelecimento.'],
          ]}
        />
        <Tip type="info" title="Por que alguns itens não aparecem?">
          O menu é filtrado por dois critérios: (1) as <strong>funcionalidades liberadas no plano de assinatura</strong>
          escolhido pelo revendedor e (2) os <strong>módulos ativos</strong> do tipo de estabelecimento
          (Configurações → Módulos ativos). Se um item sumiu, verifique esses dois lugares nessa ordem.
        </Tip>
      </DocSection>

      {/* 8 */}
      <DocSection id="admin-configuracoes" icon={Store} title="8. Configurações da Loja" subtitle="Sistema → Configurações, bloco por bloco">
        <p>
          Tudo abaixo está na mesma página: menu lateral <Path>Sistema → Configurações</Path>. A página é dividida em
          blocos independentes — <strong>cada bloco tem o próprio botão Salvar</strong>.
        </p>

        <h4 className="font-semibold mt-6 mb-2">8.1 Status da Loja</h4>
        <Fields
          rows={[
            ['Status da Loja', 'Chave que abre/fecha a loja. Só pode ser mexida com o Modo Manual ativado.'],
            ['Modo Manual', 'Desligado = o status segue automaticamente os Horários de Funcionamento. Ligado = você controla na mão (útil para fechar por imprevisto).'],
            ['Resumo do dia', 'Mostra o horário cadastrado para hoje, para conferência rápida.'],
          ]}
        />
        <Tip type="warning" title="Cuidado ao esquecer o modo manual ligado">
          Com o Modo Manual ativo a loja não reabre sozinha no dia seguinte. Ao terminar o imprevisto, desligue o
          Modo Manual: o sistema sincroniza o status com os horários na hora.
        </Tip>

        <h4 className="font-semibold mt-6 mb-2">8.2 Endereço, Contato e PIX</h4>
        <Fields
          rows={[
            ['Endereço completo', 'Rua, número, bairro e cidade. Aparece no cardápio, na comanda impressa e é a referência de origem das entregas.'],
            ['WhatsApp', 'Somente números com DDD (ex.: 11999999999). Usado nos botões de contato e nas mensagens de pedido.'],
            ['Tipo da Chave PIX', 'Telefone, CPF, CNPJ, E-mail ou Aleatória.'],
            ['Chave PIX', 'A chave exibida ao cliente que escolhe pagar por PIX manual (fora do gateway online).'],
          ]}
        />

        <h4 className="font-semibold mt-6 mb-2">8.3 Fuso horário</h4>
        <p>
          Bloco <strong>Fuso horário</strong>: selecione o IANA correspondente (ex.: <Path>America/Sao_Paulo</Path>).
          Ele controla abertura/fechamento automático, carimbo de hora dos pedidos, relatórios e fechamento de caixa.
        </p>

        <h4 className="font-semibold mt-6 mb-2">8.4 Segurança de Acesso</h4>
        <Fields
          rows={[
            ['PIN da Cozinha', 'Ligue a chave para exigir PIN na tela de Cozinha/Bar. Defina 4 a 6 dígitos ou use o botão de gerar PIN aleatório.'],
            ['PIN dos Garçons', 'Não é configurado aqui: cada garçom tem o seu PIN individual, cadastrado em Operações → Garçons.'],
          ]}
        />

        <h4 className="font-semibold mt-6 mb-2">8.5 Módulos ativos</h4>
        <p>
          O bloco <strong>Módulos ativos</strong> permite ligar/desligar manualmente capacidades que normalmente vêm
          do tipo de estabelecimento: adicionais, variantes, venda por peso, sabores, borda recheada, validade/lote,
          marca, informação nutricional, cozinha, bar, garçons, mesas, PDV de balcão, entrega, ficha técnica e módulo
          pizzaria. Use quando o cliente "sai da caixinha" (ex.: uma padaria que também faz pizza).
        </p>

        <h4 className="font-semibold mt-6 mb-2">8.6 Marketing e Rastreamento</h4>
        <Fields
          rows={[
            ['Meta Pixel ID', 'ID do pixel do Facebook/Instagram (ex.: 1234567890123456).'],
            ['Código de teste (Test Event Code)', 'Opcional, para validar eventos no Gerenciador de Eventos da Meta.'],
            ['Token da Conversion API', 'Opcional; habilita o envio de eventos server-side, mais confiável que só o pixel.'],
            ['Google Ads (AW-) e rótulo de conversão', 'Para medir conversões de campanhas do Google.'],
            ['Google Analytics 4 (G-)', 'Medição de tráfego e funil do cardápio.'],
          ]}
        />
        <Checks
          items={[
            'Eventos disparados automaticamente: visualização do cardápio, item adicionado ao carrinho, início do checkout e compra concluída.',
            'Depois de salvar, abra o cardápio em aba anônima e confira no Gerenciador de Eventos / GA4 em tempo real.',
          ]}
        />
      </DocSection>

      {/* 9 */}
      <DocSection id="admin-identidade" icon={Palette} title="9. Marca, Cores e Identidade do Cardápio" subtitle="White-label completo por estabelecimento">
        <p>Também em <Path>Sistema → Configurações</Path>, nos blocos de identidade visual.</p>

        <h4 className="font-semibold mt-6 mb-2">9.1 Identidade da Marca</h4>
        <Fields
          rows={[
            ['Nome do Restaurante', 'Nome exibido no topo do cardápio, nas comandas, nas notificações e no título da aba.'],
            ['Logo', 'Imagem quadrada (mín. 512x512, PNG com fundo transparente de preferência). Vira também o ícone do app instalado.'],
            ['Capa / Banner', 'Imagem horizontal do topo do cardápio (recomendado 1600x600).'],
            ['Preview', 'Mostra em tempo real como o cabeçalho ficará para o cliente.'],
            ['Nome do app (PWA)', 'Nome completo exibido ao instalar o cardápio na tela inicial do celular.'],
            ['Nome curto do app', 'Máximo 12 caracteres — é o texto que aparece embaixo do ícone.'],
          ]}
        />

        <h4 className="font-semibold mt-6 mb-2">9.2 Cores do Sistema</h4>
        <p>
          O bloco <strong>Cores do Sistema</strong> tem três partes: <strong>paletas prontas</strong>,
          <strong> ajuste manual</strong> e <strong>pré-visualização</strong>.
        </p>
        <Steps
          items={[
            { title: 'Escolha uma paleta pronta', description: 'Clique em uma das paletas sugeridas: ela preenche todas as cores de uma vez, já com contraste testado. É o caminho mais rápido.' },
            { title: 'Ajuste manualmente se precisar', description: 'Cada cor tem seletor visual e campo HEX (ex.: #E63946) — dá para colar o código exato da marca do cliente.' },
            { title: 'Confira a pré-visualização', description: 'O painel mostra botões, cards e textos com as cores escolhidas antes de salvar. Se algum texto ficar ilegível, ajuste a cor do texto ou a dos botões.' },
            { title: 'Salve', description: 'As cores são aplicadas na hora no painel, no cardápio, no acompanhamento de pedido e no app instalado (PWA).' },
          ]}
        />
        <Fields
          rows={[
            ['Cor Principal', 'Botões de ação, links, abas ativas, badges de destaque e barra de status do app.'],
            ['Cor Secundária', 'Elementos de apoio: selos, ícones, indicadores de status positivo.'],
            ['Cor de Fundo', 'Fundo geral das telas do cardápio e do checkout. Define se o tema é claro ou escuro.'],
            ['Cor do Texto', 'Cor do texto principal sobre o fundo. Fundo escuro exige texto claro e vice-versa.'],
            ['Cor do Texto dos Botões', 'Cor do texto que fica em cima da Cor Principal. Use branco em cores escuras e preto/grafite em cores claras (amarelo, lima, laranja claro).'],
          ]}
        />
        <Tip type="warning" title="Teste de legibilidade obrigatório">
          Antes de entregar ao cliente, abra o cardápio no celular e confira: botão "Adicionar ao carrinho",
          selos de promoção, badge "Aberto/Fechado" e o rodapé do checkout. Se algum texto "sumir" no fundo,
          o problema quase sempre é a Cor do Texto dos Botões.
        </Tip>
        <Tip type="info" title="Cores do revendedor x cores do estabelecimento">
          As cores definidas em <Path>Revendedor → Configurações</Path> valem para o seu painel e sua landing page.
          As cores aqui valem apenas para este estabelecimento. Um não sobrescreve o outro.
        </Tip>

        <h4 className="font-semibold mt-6 mb-2">9.3 Identidade do Cardápio</h4>
        <Fields
          rows={[
            ['Tipo de estabelecimento', 'Pizzaria, lanchonete, restaurante, bar, cafeteria, padaria, açaí, mercado, farmácia etc. Define os campos de produto, os módulos e o cardápio de exemplo.'],
            ['Subtipo (opcional)', 'Refina o tipo (ex.: restaurante self-service por quilo) e ajusta campos e funcionalidades.'],
            ['Personalizar textos', 'Sobrescreve os rótulos padrão do cardápio (ex.: trocar "Produtos" por "Pratos", "Adicionais" por "Complementos"). Deixe em branco para usar o padrão do tipo.'],
            ['Resetar para o padrão', 'Volta todos os textos personalizados ao padrão do tipo escolhido.'],
          ]}
        />
      </DocSection>

      {/* 10 */}
      <DocSection id="admin-cardapio" icon={Layers} title="10. Categorias e Produtos" subtitle="Gestão → Categorias e Gestão → Produtos">
        <h4 className="font-semibold mt-2 mb-2">10.1 Categorias — <Path>Gestão → Categorias</Path></h4>
        <Steps
          items={[
            { title: 'Clique em "Nova Categoria"', description: 'Crie primeiro as categorias, depois os produtos — todo produto precisa de uma categoria.' },
            { title: 'Nome e ícone', description: 'Ex.: Lanches, Pizzas, Bebidas, Sobremesas. O ícone aparece nas abas de navegação do cardápio.' },
            { title: 'Departamento (Cozinha ou Bar)', description: 'Campo decisivo: define para qual tela KDS e para qual impressora a comanda daquele item vai. Bebidas → Bar; comidas → Cozinha.' },
            { title: 'Ordem de exibição', description: 'Controla a sequência no cardápio. A primeira categoria é a que abre por padrão.' },
            { title: 'Ativa / Inativa', description: 'Categoria inativa some do cardápio junto com seus produtos, sem apagar nada.' },
          ]}
        />

        <h4 className="font-semibold mt-6 mb-2">10.2 Produtos — <Path>Gestão → Produtos</Path></h4>
        <Fields
          rows={[
            ['Nome', 'Curto e direto; é o que vai na comanda e no cupom fiscal.'],
            ['Descrição', 'Ingredientes e diferenciais. Aparece no card e no modal do produto.'],
            ['Foto', 'Upload direto. Fotos ruins podem ser tratadas em Gestão → Melhorar Fotos IA e reaproveitadas aqui.'],
            ['Preço', 'Pode ser R$ 0,00 quando todo o valor vem dos adicionais (ex.: "monte seu prato", pizza montada).'],
            ['Preço promocional', 'Quando preenchido, o preço cheio aparece riscado no cardápio.'],
            ['Categoria', 'Define onde aparece e, pelo departamento da categoria, para onde vai a comanda.'],
            ['Unidade de venda', 'Unidade, kg ou g. Itens por peso permitem ajustar o peso real antes de fechar o pedido.'],
            ['Grupos de acréscimos', 'Vincula os grupos criados na seção 11 (só aparece se o módulo de adicionais estiver ativo).'],
            ['Disponibilidade', 'Pausa o item esgotado sem excluir. Com estoque configurado, a pausa é automática ao zerar o insumo.'],
            ['Destaque', 'Coloca o produto na vitrine do topo do cardápio.'],
          ]}
        />
        <Tip type="success" title="Cardápio de exemplo em 1 clique">
          Na criação do estabelecimento existe a opção de gerar um cardápio de demonstração compatível com o tipo de
          negócio. Depois é só ajustar nomes, preços e fotos — economiza horas na implantação.
        </Tip>

        <h4 className="font-semibold mt-6 mb-2">10.3 Melhorar Fotos IA — <Path>Gestão → Melhorar Fotos IA</Path></h4>
        <Checks
          items={[
            'Envie a foto original (mesmo tirada de celular, com fundo bagunçado).',
            'A IA melhora iluminação, corta o fundo e padroniza o enquadramento.',
            'O comparador antes/depois permite aprovar ou descartar antes de aplicar.',
            'A quantidade de melhorias por mês depende do plano de assinatura contratado.',
          ]}
        />
      </DocSection>

      {/* 11 */}
      <DocSection id="admin-adicionais" icon={List} title="11. Acréscimos (Adicionais)" subtitle="Gestão → Acréscimos">
        <Steps
          items={[
            { title: 'Crie um grupo', description: 'Ex.: "Escolha o ponto da carne", "Extras", "Escolha a bebida do combo".' },
            { title: 'Defina mínimo e máximo de escolhas', description: 'Mín. 1 / máx. 1 = escolha única obrigatória (botão redondo). Máx. maior que 1 = múltipla escolha (caixas). Mín. 0 = opcional.' },
            { title: 'Marque como obrigatório se preciso', description: 'Grupo obrigatório impede adicionar ao carrinho sem escolher — evita pedido incompleto na cozinha.' },
            { title: 'Cadastre as opções', description: 'Nome + preço adicional (pode ser R$ 0,00). Reordene deixando as mais vendidas no topo.' },
            { title: 'Vincule aos produtos', description: 'Um grupo pode ser reutilizado em quantos produtos quiser — altere uma vez, vale para todos.' },
          ]}
        />
        <Tip type="info" title="Os adicionais aparecem em toda a operação">
          Tudo que o cliente escolhe é gravado no pedido e sai impresso na comanda da cozinha/bar, aparece no KDS,
          no detalhe do pedido, no PDV e no cupom.
        </Tip>
      </DocSection>

      {/* 12 */}
      <DocSection id="admin-pizzaria" icon={Pizza} title="12. Módulo Pizzaria" subtitle="Gestão → Produtos → botão 'Configurar Pizzaria'">
        <p>
          Aparece quando o tipo de estabelecimento é <strong>Pizzaria</strong> (ou o módulo pizzaria foi ligado em
          Módulos ativos). O botão fica no topo da tela <Path>Gestão → Produtos</Path>.
        </p>
        <Steps
          items={[
            { title: 'Cadastre os tamanhos', description: 'Ex.: Broto (1 sabor), Média (2 sabores), Grande (até 3 sabores). Informe fatias, máximo de sabores, preço-base e foto.' },
            { title: 'Cadastre os sabores', description: 'Nome, ingredientes, tipo (salgada/doce) e preço por tamanho. Sabor inativo some do montador.' },
            { title: 'Defina a regra de preço de múltiplos sabores', description: 'Cobrar pelo sabor mais caro ou pela média dos sabores escolhidos.' },
            { title: 'Cadastre as bordas', description: 'Ex.: sem borda, catupiry, cheddar, chocolate — com preço por tamanho.' },
            { title: 'Teste no cardápio', description: 'O cliente clica em "Monte sua pizza": escolhe tamanho → sabores → borda → adicionais, com o preço recalculado a cada passo.' },
          ]}
        />
        <Tip type="warning" title="Sabores não aparecem soltos no cardápio">
          Por decisão de usabilidade, a lista de sabores só abre dentro do montador, depois da escolha do tamanho —
          assim o preço mostrado é sempre o correto.
        </Tip>
      </DocSection>

      {/* 13 */}
      <DocSection id="admin-horarios" icon={Clock} title="13. Horários de Funcionamento" subtitle="Sistema → Horários (e bloco de horários em Configurações)">
        <Steps
          items={[
            { title: 'Abra Sistema → Horários', description: 'Os sete dias da semana aparecem em lista, cada um com sua chave de ativação.' },
            { title: 'Ative os dias de atendimento', description: 'A chave à esquerda liga/desliga o dia inteiro. Dia desligado = loja fechada naquele dia.' },
            { title: 'Edite abertura e fechamento', description: 'Clique em "Editar", ajuste os horários e clique em "Salvar". Horário que vira a madrugada (ex.: 18:00 → 02:00) é suportado.' },
            { title: 'Confirme o fuso horário', description: 'Em Configurações → Fuso horário. Fuso errado abre e fecha a loja na hora errada.' },
          ]}
        />
        <Checks
          items={[
            'Fora do horário o cardápio exibe "Fechado" e bloqueia o checkout.',
            'O bloco "Status da Loja" em Configurações sincroniza sozinho com estes horários enquanto o Modo Manual estiver desligado.',
            'O status é recalculado em tempo real, sem precisar recarregar a página.',
          ]}
        />
      </DocSection>

      {/* 14 */}
      <DocSection id="admin-entrega" icon={MapPin} title="14. Taxas de Entrega e Zonas" subtitle="Sistema → Taxas de Entrega">
        <Fields
          rows={[
            ['Zona por bairro', 'Cadastre o nome do bairro e a taxa. O cliente escolhe o bairro no checkout. É o modelo mais simples e o mais usado.'],
            ['Zona por raio (km)', 'Define faixas de distância a partir do endereço da loja (ex.: até 3 km R$ 5, até 6 km R$ 9).'],
            ['Taxa da zona', 'Valor cobrado na entrega dentro daquela zona. Use R$ 0,00 para frete grátis.'],
            ['Pedido mínimo da zona', 'Sobrescreve o pedido mínimo geral apenas para aquela zona.'],
            ['Tempo estimado', 'Minutos exibidos ao cliente no cardápio e na tela de acompanhamento do pedido.'],
            ['Zona ativa/inativa', 'Desative para parar de atender a região sem apagar o cadastro.'],
          ]}
        />
        <Steps
          items={[
            { title: 'Cadastre todas as zonas atendidas', description: 'Comece pelas regiões de maior volume; o que não estiver cadastrado não pode ser entregue.' },
            { title: 'Defina retirada no balcão', description: 'Se o estabelecimento aceita retirada, o cliente escolhe essa opção no checkout e nenhuma taxa é cobrada.' },
            { title: 'Teste um pedido real', description: 'Faça um pedido de teste em cada zona e confira taxa, mínimo e prazo exibidos.' },
          ]}
        />
      </DocSection>

      {/* 15 */}
      <DocSection id="admin-cupons" icon={Percent} title="15. Cupons e Promoções" subtitle="Gestão → Cupons">
        <Fields
          rows={[
            ['Código', 'O que o cliente digita no checkout (ex.: BEMVINDO10). Sem espaços e sem acentos.'],
            ['Tipo de desconto', 'Percentual (%) ou valor fixo (R$).'],
            ['Valor', 'O percentual ou o valor em reais concedido.'],
            ['Pedido mínimo', 'Valor mínimo do carrinho para o cupom ser aceito.'],
            ['Desconto máximo', 'Teto em reais para cupons percentuais — protege a margem em pedidos grandes.'],
            ['Validade', 'Data inicial e final. Fora do período o cupom é recusado automaticamente.'],
            ['Limite de usos', 'Total de utilizações permitidas (e, quando aplicável, por cliente).'],
            ['Ativo', 'Desligue para suspender a campanha sem apagar o histórico.'],
          ]}
        />
        <Tip type="info" title="Boas práticas">
          Crie um cupom de primeira compra com validade curta, e sempre defina pedido mínimo e desconto máximo.
          O uso de cada cupom fica registrado nos pedidos, permitindo medir a campanha nos relatórios.
        </Tip>
      </DocSection>

      {/* 16 */}
      <DocSection id="admin-pagamentos" icon={Banknote} title="16. Pagamentos: PIX, Online e Taxas" subtitle="Configurações → Pagamentos Online + Chave PIX">
        <h4 className="font-semibold mt-2 mb-2">16.1 Pagamento na entrega / no balcão</h4>
        <p>
          Dinheiro, cartão na maquininha e PIX manual não exigem integração: o cliente escolhe a forma no checkout e
          paga na entrega. A chave PIX exibida é a cadastrada em <Path>Configurações → Chave PIX</Path> (com o tipo
          correto: telefone, CPF, CNPJ, e-mail ou aleatória).
        </p>

        <h4 className="font-semibold mt-6 mb-2">16.2 Pagamento online (gateway)</h4>
        <Fields
          rows={[
            ['Habilitar este gateway', 'Liga o pagamento online no checkout do cardápio.'],
            ['Ambiente', 'Sandbox para testes, Produção para cobranças reais. Nunca entregue o cliente em sandbox.'],
            ['Credenciais (Access Token)', 'Colhidas na conta do próprio estabelecimento no provedor. Ficam mascaradas depois de salvas.'],
            ['Public Key', 'Opcional, mas obrigatória para aceitar cartão de crédito no checkout.'],
          ]}
        />
        <Checks
          items={[
            'Pago online, o pedido entra já com pagamento confirmado e segue direto para a produção.',
            'A confirmação chega por webhook — se o pedido ficar "aguardando pagamento", o webhook é o primeiro item a conferir.',
            'A taxa de conveniência (quando o plano define uma) é somada no checkout com o rótulo configurado pelo revendedor.',
          ]}
        />
      </DocSection>

      {/* 17 */}
      <DocSection id="admin-pedidos" icon={ClipboardList} title="17. Gestão de Pedidos" subtitle="Gestão → Pedidos">
        <p>
          Tela central da operação de delivery/retirada. Alterne entre <strong>visualização em blocos (kanban)</strong> e
          <strong> em lista</strong> pelo botão no topo — a preferência fica salva.
        </p>
        <Fields
          rows={[
            ['Pendente', 'Pedido recebido, aguardando aceite. Toca o alerta sonoro e envia notificação.'],
            ['Aceito / Em preparo', 'Confirmado pela loja; itens já aparecem na Cozinha/Bar e as comandas são impressas.'],
            ['Pronto', 'Produção concluída, aguardando saída para entrega ou retirada.'],
            ['Em entrega', 'Saiu com o entregador. O cliente passa a ver o rastreio em tempo real.'],
            ['Concluído', 'Entregue/retirado. Entra no faturamento do dia.'],
            ['Cancelado', 'Cancelado pela loja; devolve o estoque quando a baixa automática está ativa.'],
          ]}
        />
        <Steps
          items={[
            { title: 'Arraste ou use os botões', description: 'No kanban, arraste o card para a coluna seguinte; na lista, use os botões de avanço de status.' },
            { title: 'Abra o detalhe do pedido', description: 'Mostra itens, adicionais, observações, endereço, forma de pagamento, cupom, taxas e histórico de status.' },
            { title: 'Fale com o cliente', description: 'Botão de WhatsApp abre a conversa já com o contexto do pedido.' },
            { title: 'Atribua o entregador', description: 'No card do pedido, escolha o entregador disponível (ou deixe a atribuição automática agir).' },
            { title: 'Reimprima quando precisar', description: 'O botão de impressão reenvia a comanda para a fila da impressora correspondente.' },
          ]}
        />
        <Tip type="success" title="Tudo em tempo real">
          Novos pedidos aparecem sem recarregar a página, com som e notificação. Cada mudança de status dispara a
          atualização na tela de acompanhamento do cliente e, se configurado, a mensagem no WhatsApp.
        </Tip>
      </DocSection>

      {/* 18 */}
      <DocSection id="admin-pdv" icon={UtensilsCrossed} title="18. PDV, Mesas e Balcão" subtitle="Operações → PDV">
        <Steps
          items={[
            { title: 'Cadastre as mesas', description: 'Dentro do PDV, em "Gerenciar mesas": número/nome, capacidade e o QR Code de cada mesa para o cliente pedir pelo celular.' },
            { title: 'Abra a mesa', description: 'Clique na mesa livre, informe o nome do cliente e o número de pessoas.' },
            { title: 'Lance os itens', description: 'Busque o produto, escolha adicionais/observações e confirme: a comanda vai na hora para Cozinha ou Bar conforme o departamento da categoria.' },
            { title: 'Acompanhe pelo mapa de mesas', description: 'As cores indicam o tempo de ocupação e o status da mesa, atualizados em tempo real.' },
            { title: 'Transfira ou junte mesas', description: 'Use "Transferir" para mover a conta inteira ou itens específicos para outra mesa.' },
            { title: 'Feche a conta', description: 'Aplique desconto, taxa de serviço do garçom (0%, 5%, 10%, 12% ou valor personalizado), divida por pessoa, escolha a forma de pagamento e imprima o cupom.' },
          ]}
        />
        <h4 className="font-semibold mt-6 mb-2">Venda de balcão (sem mesa)</h4>
        <Checks
          items={[
            'Use "Venda rápida" para atendimento de balcão: lança itens e fecha na mesma tela.',
            'Aceita dinheiro (com cálculo de troco), cartão, PIX e pagamento dividido.',
            'A venda entra no caixa aberto e no faturamento do dia como qualquer outro pedido.',
            'Emissão de NFC-e no fechamento, se o módulo fiscal estiver ativo.',
          ]}
        />
      </DocSection>

      {/* 19 */}
      <DocSection id="admin-kds" icon={ChefHat} title="19. Cozinha e Bar (KDS)" subtitle="Operações → Cozinha e Operações → Bar">
        <p>
          São duas telas independentes, alimentadas pelo <strong>departamento da categoria</strong> de cada item.
          Podem rodar em tablets/TVs separados, em tela cheia.
        </p>
        <Fields
          rows={[
            ['Visão Comanda', 'Agrupa os itens por pedido/mesa — ideal para montar o pedido completo.'],
            ['Visão Item', 'Lista item a item — ideal para praças de produção (chapa, forno, montagem).'],
            ['Cronômetro por comanda', 'Tempo decorrido desde a entrada; o card muda de cor e sinaliza atraso após o tempo limite.'],
            ['Ações em lote', 'Iniciar tudo, marcar tudo pronto e marcar como entregue, direto no cabeçalho da comanda.'],
            ['Filtros', 'Por status (pendente, em preparo, pronto) e por origem (mesa ou delivery), além de busca por número/nome.'],
            ['Alerta sonoro', 'Toca a cada nova comanda; pode ser silenciado no cabeçalho.'],
            ['Tela cheia', 'Modo dedicado para o monitor da cozinha.'],
          ]}
        />
        <Tip type="info" title="Acesso protegido por PIN">
          Se o PIN da Cozinha estiver ativado em Configurações → Segurança, a tela pede o PIN ao abrir —
          assim a equipe acessa sem usar o login do proprietário.
        </Tip>
      </DocSection>

      {/* 20 */}
      <DocSection id="admin-garcons" icon={Users} title="20. Garçons" subtitle="Operações → Garçons e Operações → Acesso Garçons">
        <Steps
          items={[
            { title: 'Cadastre o garçom', description: 'Em Operações → Garçons: nome, telefone e PIN individual de 4 a 6 dígitos.' },
            { title: 'Ative/desative conforme a escala', description: 'Garçom inativo não consegue entrar e não aparece na atribuição de mesas.' },
            { title: 'Compartilhe a tela de acesso', description: <>Operações → <strong>Acesso Garçons</strong> abre a tela de login por PIN (<Path>/waiter</Path>). Salve o atalho na tela inicial do celular de cada garçom.</> },
            { title: 'Uso no salão', description: 'O garçom vê as mesas dele, abre mesa, lança pedidos com adicionais e chama o fechamento — tudo pelo celular.' },
            { title: 'Confira a produtividade', description: 'Os pedidos ficam vinculados ao garçom, permitindo medir vendas por atendente e calcular a taxa de serviço.' },
          ]}
        />
      </DocSection>

      {/* 21 */}
      <DocSection id="admin-entregadores" icon={Bike} title="21. Entregadores e Rastreio" subtitle="Operações → Entregadores, Mapa Entregadores e Acesso Entregador">
        <Steps
          items={[
            { title: 'Cadastre o entregador', description: 'Em Operações → Entregadores: nome, telefone, veículo, PIN de acesso e, se usar, valor pago por entrega.' },
            { title: 'Envie o app do entregador', description: <>Operações → <strong>Acesso Entregador</strong> abre a tela de login por PIN (<Path>/entregador</Path>), que ele instala no celular.</> },
            { title: 'Abertura de turno', description: 'Ao entrar, o entregador abre o turno e o app passa a enviar a localização em segundo plano.' },
            { title: 'Atribuição do pedido', description: 'Manual, pelo card do pedido, ou automática para o entregador disponível mais próximo. Ele aceita ou recusa a oferta pelo app.' },
            { title: 'Acompanhe pelo mapa', description: 'Operações → Mapa Entregadores mostra todos em tempo real, com status e pedido em andamento.' },
            { title: 'Rastreio do cliente', description: 'Assim que sai para entrega, o cliente vê a posição do entregador na página de acompanhamento do pedido.' },
            { title: 'Feche o turno e confira o relatório', description: 'O relatório de turnos traz entregas realizadas, tempo em rota e valores a pagar por entregador.' },
          ]}
        />
      </DocSection>

      {/* 22 */}
      <DocSection id="admin-estoque" icon={Boxes} title="22. Estoque e Ficha Técnica" subtitle="Grupo Estoque no menu lateral">
        <Steps
          items={[
            { title: 'Cadastre os fornecedores', description: <><Path>Estoque → Fornecedores</Path>: nome, contato e observações. Usados nas compras.</> },
            { title: 'Cadastre os insumos', description: <><Path>Estoque → Insumos</Path>: nome, unidade (kg, g, L, ml, un), custo médio, estoque atual e estoque mínimo para alerta.</> },
            { title: 'Monte as fichas técnicas', description: <><Path>Estoque → Ficha Técnica</Path>: para cada produto, informe quanto de cada insumo é consumido. É o que permite a baixa automática.</> },
            { title: 'Registre as compras', description: <><Path>Estoque → Compras</Path>: lance a nota do fornecedor com itens, quantidades e valores; ao receber, o estoque entra e o custo médio é recalculado.</> },
            { title: 'Acompanhe as movimentações', description: <><Path>Estoque → Movimentações</Path>: histórico de entradas, saídas, perdas e ajustes, com responsável e data.</> },
            { title: 'Analise os relatórios', description: <><Path>Estoque → Relatórios</Path>: itens abaixo do mínimo, consumo por período, valor total em estoque e custo por produto.</> },
          ]}
        />
        <Checks
          items={[
            'Toda venda (delivery, PDV ou mesa) com ficha técnica dá baixa automática nos insumos.',
            'Insumo abaixo do mínimo gera alerta no painel.',
            'Produto sem insumo suficiente pode ser pausado automaticamente no cardápio.',
            'Perdas e quebras devem ser lançadas como ajuste para o custo ficar fiel.',
          ]}
        />
      </DocSection>

      {/* 23 */}
      <DocSection id="admin-impressao" icon={Printer} title="23. Impressão Automática" subtitle="Sistema → Impressão">
        <Steps
          items={[
            { title: 'Cadastre as estações de impressão', description: 'Uma estação por impressora física (ex.: "Cozinha", "Bar", "Caixa"). Cada estação recebe só as comandas do seu departamento.' },
            { title: 'Escolha o modelo de impressora', description: 'Térmica 80mm ESC/POS (padrão do mercado). Defina largura, número de vias e se corta o papel automaticamente.' },
            { title: 'Conecte a impressora', description: 'Abra a tela de Impressão no computador ligado à impressora e autorize a conexão (Web Serial/USB). Deixe essa aba aberta: é ela que consome a fila de impressão.' },
            { title: 'Configure os gatilhos automáticos', description: 'Escolha o que imprime sozinho: novo pedido de delivery, aceite do pedido, lançamento de item na mesa, venda de balcão e fechamento de conta.' },
            { title: 'Faça o teste de impressão', description: 'Use o botão de teste para validar largura, acentuação e corte antes de abrir a loja.' },
          ]}
        />
        <Tip type="warning" title="A aba precisa ficar aberta">
          A impressão automática funciona enquanto a tela de Impressão estiver aberta no computador conectado à
          impressora. Se a comanda não sair, confira: aba aberta, estação ativa e departamento da categoria correto.
        </Tip>
        <Checks
          items={[
            'A comanda traz itens, adicionais, observações, sabores/bordas, mesa ou endereço, forma de pagamento e dados da loja.',
            'Comandas com falha ficam na fila e podem ser reenviadas manualmente.',
            'O botão de reimpressão existe no detalhe do pedido e no fechamento de mesa.',
          ]}
        />
      </DocSection>

      {/* 24 */}
      <DocSection id="admin-fiscal" icon={Receipt} title="24. Fiscal / NFC-e" subtitle="Gestão → Fiscal / NFC-e">
        <Steps
          items={[
            { title: 'Reúna os dados da empresa', description: 'CNPJ, razão social, inscrição estadual, regime tributário, endereço fiscal e CSC/Token do estado.' },
            { title: 'Envie o certificado digital A1', description: 'Arquivo .pfx com a senha. Fica armazenado de forma criptografada e é usado para assinar as notas.' },
            { title: 'Configure a numeração', description: 'Série e próximo número da NFC-e, conforme o que já foi usado pela empresa.' },
            { title: 'Defina os padrões fiscais dos produtos', description: 'NCM, CFOP, CSOSN/CST e origem. Podem ser definidos como padrão da loja e ajustados por produto.' },
            { title: 'Emita em homologação', description: 'Faça uma nota de teste no ambiente de homologação e confira a resposta da SEFAZ.' },
            { title: 'Vire para produção', description: 'Com o teste aprovado, mude o ambiente e passe a emitir de verdade no fechamento das vendas.' },
          ]}
        />
        <Checks
          items={[
            'O painel fiscal lista notas autorizadas, rejeitadas e canceladas, com o motivo da SEFAZ em português.',
            'Notas rejeitadas podem ser corrigidas e reprocessadas.',
            'Cancelamento dentro do prazo legal e inutilização de numeração estão disponíveis no mesmo painel.',
            'O DANFE/QR Code sai na impressora térmica junto do cupom.',
          ]}
        />
      </DocSection>

      {/* 25 */}
      <DocSection id="admin-whatsapp" icon={Bot} title="25. WhatsApp e Agentes IA" subtitle="Grupo WhatsApp: Chat, Conexões e Agentes IA">
        <Steps
          items={[
            { title: 'Conecte o número', description: <><Path>WhatsApp → Conexões</Path>: crie a instância e leia o QR Code com o celular do estabelecimento. O status fica "Conectado" quando dá certo.</> },
            { title: 'Use o Chat', description: <><Path>WhatsApp → Chat</Path>: caixa de entrada com todas as conversas, respostas rápidas, envio de áudio e imagens, e o histórico de pedidos do contato ao lado.</> },
            { title: 'Crie o agente de IA', description: <><Path>WhatsApp → Agentes IA</Path>: defina nome, tom de voz, saudação, regras de atendimento e horário em que o agente responde.</> },
            { title: 'Treine o agente', description: 'Envie cardápio, textos, políticas de entrega e perguntas frequentes. O agente também consulta o cardápio real (preços e disponibilidade) automaticamente.' },
            { title: 'Habilite o fechamento de pedidos', description: 'Com a ferramenta de pedidos ativa, o agente monta o carrinho, confirma endereço e forma de pagamento e cria o pedido direto no painel.' },
            { title: 'Teste no playground', description: 'Converse com o agente antes de liberar e ajuste as instruções conforme as respostas.' },
          ]}
        />
        <Checks
          items={[
            'Mensagens automáticas de status do pedido (aceito, em preparo, saiu para entrega, concluído) podem ser enviadas ao cliente.',
            'O atendente humano pode assumir a conversa a qualquer momento, pausando o agente.',
            'Os limites de conexões e de uso de IA dependem do plano contratado.',
          ]}
        />
      </DocSection>

      {/* 26 */}
      <DocSection id="admin-notificacoes" icon={Bell} title="26. Notificações e Push" subtitle="Alertas para a equipe e para o cliente">
        <Fields
          rows={[
            ['Sino de notificações', 'No topo do painel: novos pedidos, pagamentos confirmados e alertas de estoque.'],
            ['Alerta sonoro', 'Toca em Pedidos e no KDS a cada novo pedido; ative o som do dispositivo e mantenha a aba aberta.'],
            ['Push no celular da equipe', 'Instale o painel como app (PWA) e autorize as notificações para receber alertas com a tela bloqueada.'],
            ['Push para o cliente', 'O cliente pode autorizar notificações no cardápio e recebe avisos a cada mudança de status do pedido.'],
          ]}
        />
        <Tip type="warning" title="Autorize no navegador">
          Notificações só funcionam depois de autorizadas no navegador/dispositivo. Em iPhone é obrigatório instalar o
          app na tela inicial antes de autorizar.
        </Tip>
      </DocSection>

      {/* 27 */}
      <DocSection id="admin-caixa" icon={BarChart3} title="27. Caixa e Relatórios" subtitle="Operações → Caixa e Dashboard">
        <Steps
          items={[
            { title: 'Abra o caixa', description: 'No início do expediente, informe o valor inicial (fundo de troco). Sem caixa aberto não há registro de sangria/suprimento.' },
            { title: 'Registre movimentações', description: 'Sangria (retirada) e suprimento (entrada) com descrição — tudo fica registrado com data, hora e responsável.' },
            { title: 'Acompanhe durante o turno', description: 'O resumo mostra vendas por forma de pagamento, total em dinheiro esperado e movimentações do período.' },
            { title: 'Feche o caixa', description: 'Informe o valor contado em espécie: o sistema calcula a diferença (sobra/quebra) e fecha a sessão.' },
            { title: 'Analise no Dashboard', description: 'Faturamento do dia/período, número de pedidos, ticket médio, produtos mais vendidos e distribuição por status e canal.' },
          ]}
        />
      </DocSection>

      {/* 28 */}
      <DocSection id="admin-cliente" icon={Smartphone} title="28. Experiência do Cliente" subtitle="O que o cliente final vê e usa">
        <Checks
          items={[
            'Cardápio no subdomínio do estabelecimento (ex.: pizzaria-do-joao.peddi.online), com as cores e a marca dele.',
            'Busca, abas por categoria, vitrine de destaques e selo de aberto/fechado em tempo real.',
            'Modal de produto com adicionais, observações e (em pizzaria) montador de tamanho, sabores e borda.',
            'Carrinho persistente: o cliente pode fechar o navegador e voltar depois sem perder os itens.',
            'Checkout com endereço salvo, cálculo de taxa por zona, cupom, forma de pagamento e pagamento online.',
            'Tela de acompanhamento do pedido em tempo real, com etapas e rastreio do entregador no mapa.',
            'Busca de pedidos pelo número de celular, pelo botão "Meus Pedidos" no topo do cardápio.',
            'Avaliação da entrega ao final e instalação do cardápio como app (PWA) na tela inicial.',
            'Pedido na mesa por QR Code, sem instalar nada.',
          ]}
        />
      </DocSection>

      {/* 29 */}
      <DocSection id="admin-checklist" icon={CheckCircle2} title="29. Checklist de Go-Live" subtitle="Antes de entregar o estabelecimento ao cliente">
        <Checks
          items={[
            'Nome, logo, capa e nomes do app (PWA) preenchidos em Configurações → Identidade da Marca.',
            'Cores definidas e testadas no celular, incluindo a cor do texto dos botões.',
            'Tipo de estabelecimento e módulos ativos revisados.',
            'Endereço, WhatsApp e chave PIX conferidos.',
            'Fuso horário correto e horários de funcionamento dos sete dias cadastrados.',
            'Categorias com departamento (Cozinha/Bar) definido corretamente.',
            'Produtos com foto, descrição, preço e grupos de acréscimos vinculados.',
            'Pizzaria: tamanhos, sabores, bordas e regra de preço configurados e testados no montador.',
            'Zonas de entrega, taxas, pedido mínimo e prazos cadastrados.',
            'Formas de pagamento definidas e gateway online em ambiente de produção (se contratado).',
            'Estações de impressão testadas com impressão real de teste.',
            'Estoque e fichas técnicas cadastrados (se o cliente for usar).',
            'Garçons e entregadores cadastrados com PIN e com o acesso instalado no celular.',
            'WhatsApp conectado e agente de IA testado no playground.',
            'Fiscal validado em homologação antes de virar para produção.',
            'Pedido de teste completo: delivery, retirada, mesa e balcão — do carrinho ao fechamento.',
            'Proprietário treinado nas telas de Pedidos, PDV, Cozinha e Caixa.',
          ]}
        />
        <Tip type="success" title="Entrega profissional">
          Faça o pedido de teste junto com o cliente, na frente dele, passando por todas as telas. Isso reduz
          drasticamente o volume de suporte nos primeiros dias.
        </Tip>
      </DocSection>
    </>
  );
}
