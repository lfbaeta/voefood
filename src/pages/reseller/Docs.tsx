import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  Building2,
  Store,
  CreditCard,
  Settings,
  Palette,
  Globe,
  BarChart3,
  HelpCircle,
  ChevronUp,
  CheckCircle2,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  Users,
  Rocket,
  Shield,
  Webhook,
  FileText,
  Phone,
  Mail,
  UserPlus,
  Key,
  Link2,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  Copy,
  ExternalLink,
  Play,
  Pause,
  Clock,
  DollarSign,
  PieChart,
  TrendingUp,
  MessageSquare,
  Image,
  Type,
  Hash,
  List,
  Check,
  X,
  ArrowDown,
  CircleDot,
  Layers,
  Monitor,
  Smartphone,
  LayoutDashboard,
  Package,
  ClipboardList,
  ChefHat,
  UtensilsCrossed,
  Receipt,
  MapPin,
  Timer,
  Percent,
  Gift,
  Star,
  Zap,
} from 'lucide-react';

// Navigation sections - reorganized to start with setup
const sections = [
  { id: 'bem-vindo', label: 'Bem-vindo', icon: BookOpen },
  { id: 'criar-conta', label: '1. Criar Conta de Revendedor', icon: UserPlus },
  { id: 'configurar-perfil', label: '2. Configurar Perfil', icon: Settings },
  { id: 'integrar-pagamentos', label: '3. Integrar Mercado Pago', icon: CreditCard },
  { id: 'criar-planos', label: '4. Criar Planos', icon: Package },
  { id: 'criar-estabelecimento', label: '5. Criar Estabelecimentos', icon: Store },
  { id: 'landing-page', label: '6. Landing Page', icon: Globe },
  { id: 'gestao-estabelecimentos', label: 'Gestão de Estabelecimentos', icon: Building2 },
  { id: 'monitoramento', label: 'Monitoramento', icon: BarChart3 },
  { id: 'painel-estabelecimento', label: 'Painel do Estabelecimento', icon: LayoutDashboard },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
];

// Tip Card Component
function TipCard({ type = 'info', title, children }: { type?: 'info' | 'warning' | 'success'; title: string; children: React.ReactNode }) {
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

// Step with number
function NumberedStep({ number, title, children, isLast = false }: { number: number; title: string; children: React.ReactNode; isLast?: boolean }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
          {number}
        </div>
        {!isLast && <div className="w-0.5 h-full bg-border mt-2" />}
      </div>
      <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
        <h4 className="font-semibold text-foreground mb-2">{title}</h4>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

// Code block component
function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <div className="bg-muted rounded-lg p-4 my-3">
      {label && <p className="text-xs text-muted-foreground mb-2">{label}</p>}
      <code className="text-sm break-all">{children}</code>
    </div>
  );
}

// Screenshot placeholder
function ScreenshotPlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 my-4 text-center bg-muted/30">
      <Monitor className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

// Feature card
function FeatureCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
      <Icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// Check list
function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 my-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// Flow diagram
function FlowDiagram({ title, steps }: { title: string; steps: { label: string; description?: string }[] }) {
  return (
    <div className="my-6">
      <p className="font-medium text-sm mb-4 text-muted-foreground">{title}</p>
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 text-center min-w-[120px]">
              <p className="font-medium text-sm">{step.label}</p>
              {step.description && (
                <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
              )}
            </div>
            {index < steps.length - 1 && (
              <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Architecture Diagram
function ArchitectureDiagram() {
  return (
    <div className="my-6 p-6 bg-muted/50 rounded-xl border">
      <p className="font-medium text-sm mb-6 text-center text-muted-foreground">Arquitetura do Sistema</p>
      <div className="flex flex-col items-center gap-4">
        <div className="bg-primary text-primary-foreground rounded-xl px-6 py-4 text-center shadow-lg">
          <Building2 className="h-6 w-6 mx-auto mb-2" />
          <p className="font-bold">Revendedor (Você)</p>
          <p className="text-xs opacity-80">Gerencia tudo de um único painel</p>
        </div>
        
        <div className="h-8 w-0.5 bg-border" />
        
        <div className="flex flex-wrap justify-center gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border rounded-xl px-4 py-3 text-center shadow">
              <Store className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="font-medium text-sm">Estabelecimento {i}</p>
              <p className="text-xs text-muted-foreground">Cliente seu</p>
            </div>
          ))}
        </div>
        
        <div className="h-8 w-0.5 bg-border" />
        
        <div className="bg-muted rounded-xl px-6 py-4 text-center">
          <Users className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="font-medium">Clientes Finais</p>
          <p className="text-xs text-muted-foreground">Fazem pedidos pelo cardápio digital</p>
        </div>
      </div>
    </div>
  );
}

// Table component
function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border rounded-lg overflow-hidden">
        <thead className="bg-muted">
          <tr>
            {headers.map((header, i) => (
              <th key={i} className="text-left py-2 px-3 font-medium">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t">
              {row.map((cell, j) => (
                <td key={j} className="py-2 px-3">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ResellerDocs() {
  const [activeSection, setActiveSection] = useState('bem-vindo');
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);

      const sectionElements = sections.map(s => ({
        id: s.id,
        element: document.getElementById(s.id),
      }));

      for (const section of sectionElements.reverse()) {
        if (section.element) {
          const rect = section.element.getBoundingClientRect();
          if (rect.top <= 150) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <Helmet>
        <title>Documentação Completa - Plataforma de Cardápio Digital</title>
        <meta name="description" content="Guia completo passo a passo para configurar e gerenciar sua plataforma de cardápio digital multi-tenant." />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-card border-b border-border">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-foreground">Documentação Completa</h1>
                <p className="text-xs text-muted-foreground">Guia passo a passo para revendedores</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link 
                to="/setup" 
                className="text-sm text-muted-foreground hover:text-foreground hidden sm:block"
              >
                Criar Conta
              </Link>
              <Link 
                to="/auth" 
                className="text-sm text-primary hover:underline font-medium"
              >
                Fazer Login →
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex gap-6">
            {/* Sidebar Navigation - Desktop */}
            <aside className="hidden xl:block w-72 flex-shrink-0">
              <div className="sticky top-24">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Índice do Guia
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">Siga na ordem para melhor experiência</p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ScrollArea className="h-[calc(100vh-250px)]">
                      <nav className="space-y-1">
                        {sections.map((section, index) => (
                          <button
                            key={section.id}
                            onClick={() => scrollToSection(section.id)}
                            className={cn(
                              'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors text-left',
                              activeSection === section.id
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                          >
                            <section.icon className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{section.label}</span>
                          </button>
                        ))}
                      </nav>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 min-w-0 space-y-8">
              {/* Mobile Navigation */}
              <Card className="xl:hidden">
                <CardContent className="p-4">
                  <ScrollArea className="w-full">
                    <div className="flex gap-2 pb-2">
                      {sections.map((section) => (
                        <Button
                          key={section.id}
                          variant={activeSection === section.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => scrollToSection(section.id)}
                          className="flex-shrink-0"
                        >
                          {section.label}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* ======================= */}
              {/* SECTION: BEM-VINDO */}
              {/* ======================= */}
              <section id="bem-vindo" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Rocket className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Bem-vindo à Plataforma!</CardTitle>
                        <p className="text-sm text-muted-foreground">Seu negócio de cardápios digitais começa aqui</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-base">
                      Esta é uma plataforma <strong>multi-tenant</strong> que permite a você, como revendedor, 
                      criar e gerenciar múltiplos estabelecimentos, cada um com seu próprio cardápio digital, 
                      sistema de pedidos e painel administrativo.
                    </p>

                    <TipCard type="success" title="O que você vai construir">
                      Ao final deste guia, você terá uma operação completa funcionando: conta de revendedor 
                      configurada, planos de assinatura criados, integração de pagamentos ativa, e pronto 
                      para cadastrar seus primeiros estabelecimentos clientes!
                    </TipCard>

                    <ArchitectureDiagram />

                    <h4 className="font-semibold mt-6 mb-3">O que a plataforma oferece?</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <FeatureCard 
                        icon={Store} 
                        title="Gestão Multi-Estabelecimento" 
                        description="Gerencie dezenas de estabelecimentos de um único painel" 
                      />
                      <FeatureCard 
                        icon={CreditCard} 
                        title="Cobrança Automática" 
                        description="Mensalidades cobradas automaticamente via Mercado Pago" 
                      />
                      <FeatureCard 
                        icon={Palette} 
                        title="White-Label Completo" 
                        description="Sua marca, suas cores, seu domínio" 
                      />
                      <FeatureCard 
                        icon={Globe} 
                        title="Landing Page de Vendas" 
                        description="Página pronta para captar novos clientes" 
                      />
                      <FeatureCard 
                        icon={BarChart3} 
                        title="Dashboard Financeiro" 
                        description="Acompanhe receitas, inadimplência e crescimento" 
                      />
                      <FeatureCard 
                        icon={Smartphone} 
                        title="PWA Instalável" 
                        description="Funciona como app no celular dos clientes" 
                      />
                    </div>

                    <h4 className="font-semibold mt-8 mb-3">Jornada de Configuração (6 etapas)</h4>
                    <FlowDiagram 
                      title="Complete cada etapa na ordem indicada:"
                      steps={[
                        { label: '1. Criar Conta', description: 'Cadastro inicial' },
                        { label: '2. Perfil', description: 'Dados da empresa' },
                        { label: '3. Pagamentos', description: 'Mercado Pago' },
                        { label: '4. Planos', description: 'Preços e recursos' },
                        { label: '5. Estabelecimentos', description: 'Seus clientes' },
                        { label: '6. Landing', description: 'Captar vendas' },
                      ]}
                    />

                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-6">
                      <p className="font-semibold text-sm mb-2">🚀 Pronto para começar?</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Siga para a próxima seção e crie sua conta de revendedor.
                      </p>
                      <Button size="sm" onClick={() => scrollToSection('criar-conta')}>
                        Começar Configuração <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* ======================= */}
              {/* SECTION: CRIAR CONTA */}
              {/* ======================= */}
              <section id="criar-conta" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                        <span className="text-primary-foreground font-bold">1</span>
                      </div>
                      <div>
                        <CardTitle className="text-xl">Criar Conta de Revendedor</CardTitle>
                        <p className="text-sm text-muted-foreground">Primeiro passo: seu cadastro no sistema</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                    <TipCard type="info" title="Conta única">
                      O sistema permite apenas <strong>um revendedor</strong> por instalação. 
                      Se você está implantando para um cliente, crie a conta com os dados dele.
                    </TipCard>

                    <h4 className="font-semibold mt-6 mb-4">Passo a passo</h4>
                    
                    <NumberedStep number={1} title="Acessar página de setup">
                      <p>Acesse a URL de configuração inicial:</p>
                      <CodeBlock label="URL de Setup">/setup</CodeBlock>
                      <p className="mt-2">
                        Se aparecer "Sistema já configurado", significa que já existe um revendedor. 
                        Nesse caso, faça login em <code>/auth</code>.
                      </p>
                    </NumberedStep>

                    <NumberedStep number={2} title="Preencher dados obrigatórios">
                      <DataTable 
                        headers={['Campo', 'Descrição', 'Exemplo']}
                        rows={[
                          ['Seu nome *', 'Nome completo do responsável', 'João Silva'],
                          ['Email *', 'Email para login (será o usuário)', 'joao@empresa.com'],
                          ['Senha *', 'Mínimo 6 caracteres', '********'],
                          ['Confirmar senha *', 'Repita a senha', '********'],
                        ]}
                      />
                    </NumberedStep>

                    <NumberedStep number={3} title="Preencher dados opcionais (recomendado)">
                      <DataTable 
                        headers={['Campo', 'Descrição', 'Exemplo']}
                        rows={[
                          ['Nome da empresa', 'Razão social ou fantasia', 'Tech Menus Ltda'],
                          ['Telefone', 'Com DDD', '(11) 99999-9999'],
                        ]}
                      />
                    </NumberedStep>

                    <NumberedStep number={4} title="Criar conta" isLast>
                      <p>Clique em <strong>"Criar conta de revendedor"</strong>.</p>
                      <CheckList items={[
                        'Conta de usuário criada automaticamente',
                        'Registro de revendedor vinculado',
                        'Login automático realizado',
                        'Redirecionamento para o painel',
                      ]} />
                    </NumberedStep>

                    <TipCard type="warning" title="Guarde suas credenciais!">
                      Anote o email e senha em local seguro. Você precisará deles para acessar 
                      o painel de revendedor. Não há recuperação automática de senha ainda.
                    </TipCard>

                    <h4 className="font-semibold mt-8 mb-3">O que acontece após criar a conta?</h4>
                    <p>
                      Você será redirecionado para o <strong>painel de revendedor</strong> em <code>/reseller</code>. 
                      O painel estará vazio porque você ainda não tem estabelecimentos. 
                      Antes de criar estabelecimentos, precisamos configurar algumas coisas essenciais.
                    </p>

                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-6">
                      <p className="font-semibold text-sm mb-2">✅ Etapa concluída!</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Sua conta está criada. Agora vamos configurar seu perfil e dados da empresa.
                      </p>
                      <Button size="sm" onClick={() => scrollToSection('configurar-perfil')}>
                        Próximo: Configurar Perfil <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* ======================= */}
              {/* SECTION: CONFIGURAR PERFIL */}
              {/* ======================= */}
              <section id="configurar-perfil" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                        <span className="text-primary-foreground font-bold">2</span>
                      </div>
                      <div>
                        <CardTitle className="text-xl">Configurar Perfil e Marca</CardTitle>
                        <p className="text-sm text-muted-foreground">Personalize sua identidade visual</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                    <p>
                      Agora vamos completar seu perfil e definir as cores da sua marca. 
                      Isso será usado no painel e na landing page.
                    </p>

                    <h4 className="font-semibold mt-6 mb-4">Acessando as Configurações</h4>
                    
                    <NumberedStep number={1} title="Navegar para Configurações">
                      <p>No menu lateral do painel de revendedor, clique em <strong>"Configurações"</strong>.</p>
                      <p className="text-xs text-muted-foreground mt-1">Caminho: /reseller/settings</p>
                    </NumberedStep>

                    <NumberedStep number={2} title="Completar dados do perfil">
                      <p>Na seção <strong>"Informações do Revendedor"</strong>, preencha:</p>
                      <DataTable 
                        headers={['Campo', 'O que colocar']}
                        rows={[
                          ['Nome', 'Seu nome ou nome do responsável'],
                          ['Email', 'Email de contato (pode ser diferente do login)'],
                          ['Telefone', 'Número com DDD para contato'],
                          ['Nome da Empresa', 'Nome que aparecerá para os clientes'],
                        ]}
                      />
                    </NumberedStep>

                    <NumberedStep number={3} title="Definir cores da marca">
                      <p>Na seção <strong>"Cores da Marca"</strong>, escolha:</p>
                      <div className="grid grid-cols-2 gap-3 my-3">
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-4 h-4 rounded bg-primary" />
                            <p className="font-medium text-sm">Cor Primária</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Botões, links, destaques principais
                          </p>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-4 h-4 rounded bg-secondary" />
                            <p className="font-medium text-sm">Cor Secundária</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Acentos, elementos complementares
                          </p>
                        </div>
                      </div>
                    </NumberedStep>

                    <NumberedStep number={4} title="Configurar slug da landing page">
                      <p>
                        O <strong>slug</strong> é a URL personalizada da sua landing page. 
                        Escolha algo curto e fácil de lembrar.
                      </p>
                      <CodeBlock label="Exemplo de URL final">
                        https://seusite.com/lp/minha-empresa
                      </CodeBlock>
                      <TipCard type="warning" title="Regras do slug">
                        Use apenas letras minúsculas, números e hífens. 
                        Não use espaços, acentos ou caracteres especiais.
                        Exemplos válidos: <code>tech-menus</code>, <code>cardapios-digitais</code>
                      </TipCard>
                    </NumberedStep>

                    <NumberedStep number={5} title="Salvar alterações" isLast>
                      <p>Clique em <strong>"Salvar Configurações"</strong> no final da página.</p>
                    </NumberedStep>

                    <TipCard type="success" title="Dica de branding">
                      Use as cores oficiais da sua empresa. Se não tem identidade visual definida, 
                      escolha cores que transmitam profissionalismo e confiança no setor de alimentação 
                      (tons de verde, laranja ou vermelho costumam funcionar bem).
                    </TipCard>

                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-6">
                      <p className="font-semibold text-sm mb-2">✅ Etapa concluída!</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Seu perfil está configurado. Agora vamos integrar o Mercado Pago para cobranças automáticas.
                      </p>
                      <Button size="sm" onClick={() => scrollToSection('integrar-pagamentos')}>
                        Próximo: Integrar Mercado Pago <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* ======================= */}
              {/* SECTION: INTEGRAR PAGAMENTOS */}
              {/* ======================= */}
              <section id="integrar-pagamentos" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                        <span className="text-primary-foreground font-bold">3</span>
                      </div>
                      <div>
                        <CardTitle className="text-xl">Integrar Mercado Pago</CardTitle>
                        <p className="text-sm text-muted-foreground">Configure cobranças automáticas de mensalidades</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                    <p>
                      A integração com Mercado Pago permite cobrar automaticamente as mensalidades 
                      dos seus estabelecimentos. Quando um pagamento falha, o sistema suspende o estabelecimento 
                      automaticamente.
                    </p>

                    <FlowDiagram 
                      title="Como funciona a cobrança automática:"
                      steps={[
                        { label: 'Estabelecimento Criado' },
                        { label: 'Link de Assinatura' },
                        { label: 'Cliente Paga' },
                        { label: 'Webhook Notifica' },
                        { label: 'Status Atualizado' },
                      ]}
                    />

                    <TipCard type="warning" title="Pré-requisito">
                      Você precisa de uma conta Mercado Pago <strong>verificada</strong> para usar esta integração. 
                      Se ainda não tem, crie em <a href="https://www.mercadopago.com.br" target="_blank" rel="noopener noreferrer">mercadopago.com.br</a>.
                    </TipCard>

                    <h4 className="font-semibold mt-6 mb-4">Parte 1: Obter credenciais no Mercado Pago</h4>
                    
                    <NumberedStep number={1} title="Acessar sua conta Mercado Pago">
                      <p>
                        Acesse <a href="https://www.mercadopago.com.br" target="_blank" rel="noopener noreferrer">mercadopago.com.br</a> e faça login.
                      </p>
                    </NumberedStep>

                    <NumberedStep number={2} title="Ir para Credenciais">
                      <p>Navegue até:</p>
                      <p className="font-medium mt-2">
                        Seu negócio → Configurações → Credenciais
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ou acesse diretamente: <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank">developers/panel/app</a>
                      </p>
                    </NumberedStep>

                    <NumberedStep number={3} title="Selecionar credenciais de PRODUÇÃO">
                      <p>
                        <strong>Importante:</strong> Escolha <Badge variant="outline" className="bg-emerald-100 text-emerald-700">Produção</Badge>, 
                        não "Teste". As credenciais de teste não processam pagamentos reais.
                      </p>
                    </NumberedStep>

                    <NumberedStep number={4} title="Copiar Access Token e Public Key" isLast>
                      <DataTable 
                        headers={['Credencial', 'Formato', 'Uso']}
                        rows={[
                          ['Access Token', 'APP_USR-xxxx-xxxx-xxxx...', 'Autenticação de API (SECRETO)'],
                          ['Public Key', 'APP_USR-xxxx-xxxx-xxxx...', 'Identificação pública'],
                        ]}
                      />
                      <TipCard type="warning" title="Segurança">
                        O Access Token é <strong>secreto</strong>. Nunca compartilhe publicamente, 
                        não coloque em código fonte, não envie por email ou WhatsApp.
                      </TipCard>
                    </NumberedStep>

                    <h4 className="font-semibold mt-8 mb-4">Parte 2: Configurar no sistema</h4>

                    <NumberedStep number={1} title="Acessar configurações">
                      <p>No painel de revendedor, vá em <strong>Configurações</strong>.</p>
                    </NumberedStep>

                    <NumberedStep number={2} title="Encontrar seção Mercado Pago">
                      <p>Role a página até encontrar <strong>"Integração Mercado Pago"</strong>.</p>
                    </NumberedStep>

                    <NumberedStep number={3} title="Colar as credenciais">
                      <CheckList items={[
                        'Cole o Access Token no campo correspondente',
                        'Cole a Public Key no campo correspondente',
                        'Ative a opção "Habilitar integração"',
                      ]} />
                    </NumberedStep>

                    <NumberedStep number={4} title="Salvar" isLast>
                      <p>Clique em <strong>"Salvar Configurações"</strong>.</p>
                    </NumberedStep>

                    <h4 className="font-semibold mt-8 mb-4">Parte 3: Configurar Webhook (IMPORTANTE!)</h4>
                    <p>
                      O webhook é o que permite o sistema receber notificações automáticas de pagamentos. 
                      <strong> Sem ele, os status não serão atualizados automaticamente.</strong>
                    </p>

                    <NumberedStep number={1} title="Copiar URL do webhook">
                      <CodeBlock label="URL do Webhook (copie exatamente)">
                        https://fcsgjhxcvglmvkbnbiur.supabase.co/functions/v1/mercadopago-webhook
                      </CodeBlock>
                    </NumberedStep>

                    <NumberedStep number={2} title="Configurar no Mercado Pago">
                      <p>No painel do Mercado Pago, vá em:</p>
                      <p className="font-medium mt-2">
                        Seu negócio → Configurações → Webhooks → Configurar notificações
                      </p>
                    </NumberedStep>

                    <NumberedStep number={3} title="Colar a URL">
                      <p>Cole a URL copiada no campo de endpoint.</p>
                    </NumberedStep>

                    <NumberedStep number={4} title="Selecionar eventos">
                      <p>Marque os seguintes eventos para notificação:</p>
                      <CheckList items={[
                        'Pagamentos (payment)',
                        'Assinaturas / Preapproval (preapproval)',
                      ]} />
                    </NumberedStep>

                    <NumberedStep number={5} title="Salvar webhook" isLast>
                      <p>Clique em Salvar no Mercado Pago.</p>
                    </NumberedStep>

                    <TipCard type="success" title="Integração completa!">
                      Com tudo configurado, o sistema vai:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Gerar links de assinatura para novos estabelecimentos</li>
                        <li>Receber notificações de pagamentos em tempo real</li>
                        <li>Atualizar status dos estabelecimentos automaticamente</li>
                        <li>Suspender estabelecimentos inadimplentes</li>
                        <li>Reativar após regularização</li>
                      </ul>
                    </TipCard>

                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-6">
                      <p className="font-semibold text-sm mb-2">✅ Etapa concluída!</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Mercado Pago integrado! Agora vamos criar os planos de assinatura.
                      </p>
                      <Button size="sm" onClick={() => scrollToSection('criar-planos')}>
                        Próximo: Criar Planos <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* ======================= */}
              {/* SECTION: CRIAR PLANOS */}
              {/* ======================= */}
              <section id="criar-planos" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                        <span className="text-primary-foreground font-bold">4</span>
                      </div>
                      <div>
                        <CardTitle className="text-xl">Criar Planos de Assinatura</CardTitle>
                        <p className="text-sm text-muted-foreground">Defina pacotes e preços para seus clientes</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                    <p>
                      Os planos definem quanto você vai cobrar dos estabelecimentos e quais recursos 
                      eles terão acesso. Você pode criar quantos planos quiser.
                    </p>

                    <TipCard type="info" title="Estratégia de precificação">
                      Recomendamos criar <strong>3 planos</strong> (Básico, Profissional, Premium). 
                      O plano do meio costuma ser o mais vendido - marque-o como "Popular".
                    </TipCard>

                    <h4 className="font-semibold mt-6 mb-4">Acessando a gestão de planos</h4>
                    
                    <NumberedStep number={1} title="Ir para Mensalidades">
                      <p>No menu lateral, clique em <strong>"Mensalidades"</strong>.</p>
                      <p className="text-xs text-muted-foreground mt-1">Caminho: /reseller/subscriptions</p>
                    </NumberedStep>

                    <NumberedStep number={2} title="Criar novo plano">
                      <p>Clique no botão <strong>"Novo Plano"</strong>.</p>
                    </NumberedStep>

                    <NumberedStep number={3} title="Preencher informações do plano">
                      <DataTable 
                        headers={['Campo', 'Descrição', 'Exemplo']}
                        rows={[
                          ['Nome *', 'Nome exibido para clientes', 'Plano Profissional'],
                          ['Descrição', 'Breve descrição do plano', 'Ideal para estabelecimentos médios'],
                          ['Valor Mensal *', 'Quanto cobrar por mês (R$)', '149,90'],
                          ['Taxa de Setup', 'Valor único na adesão (opcional)', '99,00'],
                          ['Dias de Trial', 'Período gratuito inicial', '7'],
                          ['Recursos', 'Lista de funcionalidades inclusas', 'Cardápio ilimitado, Suporte'],
                          ['Popular', 'Destaca na landing page', 'Sim/Não'],
                        ]}
                      />
                    </NumberedStep>

                    <NumberedStep number={4} title="Definir recursos (features)">
                      <p>
                        Os recursos são uma lista de funcionalidades que aparecem na landing page. 
                        Adicione um por linha.
                      </p>
                      <div className="bg-muted rounded-lg p-3 my-3">
                        <p className="text-xs text-muted-foreground mb-2">Exemplo de recursos:</p>
                        <ul className="text-sm space-y-1">
                          <li>✓ Cardápio digital ilimitado</li>
                          <li>✓ Pedidos via WhatsApp</li>
                          <li>✓ Painel administrativo completo</li>
                          <li>✓ Relatórios básicos</li>
                          <li>✓ Suporte por email</li>
                        </ul>
                      </div>
                    </NumberedStep>

                    <NumberedStep number={5} title="Salvar plano" isLast>
                      <p>Clique em <strong>"Criar Plano"</strong>.</p>
                    </NumberedStep>

                    <h4 className="font-semibold mt-8 mb-4">Exemplo de estrutura de 3 planos</h4>
                    <DataTable 
                      headers={['Plano', 'Mensal', 'Setup', 'Trial', 'Popular']}
                      rows={[
                        ['Básico', 'R$ 79,90', 'R$ 0', '14 dias', 'Não'],
                        ['Profissional', 'R$ 149,90', 'R$ 99', '7 dias', 'Sim ⭐'],
                        ['Premium', 'R$ 249,90', 'R$ 0', '7 dias', 'Não'],
                      ]}
                    />

                    <TipCard type="success" title="Planos criados aparecem automaticamente">
                      Os planos ativos aparecerão automaticamente na sua Landing Page 
                      e estarão disponíveis ao criar novos estabelecimentos.
                    </TipCard>

                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-6">
                      <p className="font-semibold text-sm mb-2">✅ Etapa concluída!</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Planos criados! Agora você pode criar seu primeiro estabelecimento.
                      </p>
                      <Button size="sm" onClick={() => scrollToSection('criar-estabelecimento')}>
                        Próximo: Criar Estabelecimentos <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* ======================= */}
              {/* SECTION: CRIAR RESTAURANTE */}
              {/* ======================= */}
              <section id="criar-estabelecimento" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                        <span className="text-primary-foreground font-bold">5</span>
                      </div>
                      <div>
                        <CardTitle className="text-xl">Criar Estabelecimentos</CardTitle>
                        <p className="text-sm text-muted-foreground">Cadastre seus clientes na plataforma</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                    <p>
                      Agora vamos criar seu primeiro estabelecimento. Cada estabelecimento terá seu próprio 
                      cardápio, painel admin e URL exclusiva.
                    </p>

                    <h4 className="font-semibold mt-6 mb-4">Criando um estabelecimento</h4>
                    
                    <NumberedStep number={1} title="Ir para Estabelecimentos">
                      <p>No menu lateral, clique em <strong>"Estabelecimentos"</strong>.</p>
                      <p className="text-xs text-muted-foreground mt-1">Caminho: /reseller/restaurants</p>
                    </NumberedStep>

                    <NumberedStep number={2} title="Clicar em Novo Estabelecimento">
                      <p>Clique no botão <strong>"Novo Estabelecimento"</strong>.</p>
                    </NumberedStep>

                    <NumberedStep number={3} title="Preencher dados do estabelecimento">
                      <DataTable 
                        headers={['Campo', 'Descrição', 'Exemplo']}
                        rows={[
                          ['Nome *', 'Nome do estabelecimento', 'Pizzaria Bella Napoli'],
                          ['Slug *', 'URL única (sem espaços)', 'pizzaria-bella-napoli'],
                          ['Nome do Proprietário', 'Quem é o dono', 'Maria Santos'],
                          ['Email de Contato', 'Email do proprietário', 'maria@pizzaria.com'],
                          ['Telefone', 'WhatsApp do estabelecimento', '(11) 99999-9999'],
                        ]}
                      />
                      
                      <TipCard type="warning" title="Sobre o Slug">
                        O slug define a URL do cardápio: <code>seusite.com/pizzaria-bella-napoli</code>. 
                        Use apenas letras minúsculas, números e hífens. <strong>Não pode ser alterado depois!</strong>
                      </TipCard>
                    </NumberedStep>

                    <NumberedStep number={4} title="Selecionar plano de assinatura">
                      <p>Escolha um dos planos que você criou anteriormente.</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        O valor mensal e período de trial serão aplicados automaticamente.
                      </p>
                    </NumberedStep>

                    <NumberedStep number={5} title="Criar estabelecimento" isLast>
                      <p>Clique em <strong>"Criar Estabelecimento"</strong>.</p>
                      <CheckList items={[
                        'Estabelecimento criado e ativo',
                        'Se Mercado Pago configurado: link de assinatura gerado',
                        'Status inicial: Trial (se tiver dias de trial)',
                        'Pronto para receber configurações',
                      ]} />
                    </NumberedStep>

                    <h4 className="font-semibold mt-8 mb-4">Criando administrador para o estabelecimento</h4>
                    <p>
                      O proprietário precisa de uma conta de administrador para acessar o painel do estabelecimento.
                    </p>

                    <NumberedStep number={1} title="Acessar detalhes do estabelecimento">
                      <p>Na lista de estabelecimentos, clique no estabelecimento que você criou.</p>
                    </NumberedStep>

                    <NumberedStep number={2} title="Ir para seção Administradores">
                      <p>Role até a seção <strong>"Administradores"</strong>.</p>
                    </NumberedStep>

                    <NumberedStep number={3} title="Adicionar administrador">
                      <p>Clique em <strong>"Adicionar Administrador"</strong> e preencha:</p>
                      <DataTable 
                        headers={['Campo', 'Descrição']}
                        rows={[
                          ['Email *', 'Email que será usado para login'],
                          ['Senha temporária *', 'Senha inicial (orientar a trocar)'],
                        ]}
                      />
                    </NumberedStep>

                    <NumberedStep number={4} title="Compartilhar credenciais" isLast>
                      <p>
                        Envie as credenciais para o proprietário junto com a URL de login:
                      </p>
                      <CodeBlock label="URL de login do estabelecimento">/auth</CodeBlock>
                      <TipCard type="info" title="Oriente o cliente">
                        Peça para o proprietário trocar a senha no primeiro acesso 
                        (não há fluxo automático ainda, então é uma boa prática).
                      </TipCard>
                    </NumberedStep>

                    <h4 className="font-semibold mt-8 mb-4">Status do estabelecimento</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Trial</Badge>
                        <span className="text-sm">Período de teste gratuito ativo</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Ativo</Badge>
                        <span className="text-sm">Pagamento em dia, funcionando normalmente</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">Suspenso</Badge>
                        <span className="text-sm">Inadimplente - cardápio bloqueado</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Cancelado</Badge>
                        <span className="text-sm">Assinatura cancelada definitivamente</span>
                      </div>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-6">
                      <p className="font-semibold text-sm mb-2">✅ Etapa concluída!</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Seu primeiro estabelecimento está criado! Agora vamos configurar sua landing page para captar mais clientes.
                      </p>
                      <Button size="sm" onClick={() => scrollToSection('landing-page')}>
                        Próximo: Landing Page <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* ======================= */}
              {/* SECTION: LANDING PAGE */}
              {/* ======================= */}
              <section id="landing-page" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                        <span className="text-primary-foreground font-bold">6</span>
                      </div>
                      <div>
                        <CardTitle className="text-xl">Configurar Landing Page</CardTitle>
                        <p className="text-sm text-muted-foreground">Sua página de vendas white-label</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                    <p>
                      A landing page é sua página de vendas pública. Novos clientes podem conhecer 
                      seus serviços, ver os planos e entrar em contato para contratar.
                    </p>

                    <h4 className="font-semibold mt-6 mb-4">Ativando a landing page</h4>
                    
                    <NumberedStep number={1} title="Ir para Configurações">
                      <p>No menu lateral, clique em <strong>"Configurações"</strong>.</p>
                    </NumberedStep>

                    <NumberedStep number={2} title="Encontrar seção Landing Page">
                      <p>Role até a seção <strong>"Configurações da Landing Page"</strong>.</p>
                    </NumberedStep>

                    <NumberedStep number={3} title="Ativar landing page">
                      <p>Marque a opção <strong>"Habilitar Landing Page"</strong>.</p>
                    </NumberedStep>

                    <NumberedStep number={4} title="Configurar slug" isLast>
                      <p>
                        Defina o slug (se ainda não fez). Sua landing page ficará disponível em:
                      </p>
                      <CodeBlock label="URL da sua landing page">
                        https://seusite.com/lp/seu-slug
                      </CodeBlock>
                    </NumberedStep>

                    <h4 className="font-semibold mt-8 mb-4">Personalizando a landing page</h4>
                    <DataTable 
                      headers={['Configuração', 'O que é', 'Dica']}
                      rows={[
                        ['Logo', 'Imagem da sua marca', 'Use PNG com fundo transparente'],
                        ['Título', 'Headline principal', 'Ex: "Cardápio Digital para seu Estabelecimento"'],
                        ['Subtítulo', 'Texto complementar', 'Ex: "Aumente suas vendas em até 30%"'],
                        ['Cores', 'Primária e secundária', 'Use as cores da sua marca'],
                        ['WhatsApp', 'Número de contato', 'Com DDD, sem formatação'],
                        ['Email', 'Email de contato', 'Email profissional'],
                        ['Estatísticas', 'Números de destaque', 'Estabelecimentos ativos, pedidos, etc'],
                        ['Depoimentos', 'Avaliações de clientes', 'Use depoimentos reais'],
                        ['FAQ', 'Perguntas frequentes', 'Responda dúvidas comuns'],
                      ]}
                    />

                    <h4 className="font-semibold mt-8 mb-4">O que aparece na landing page</h4>
                    <CheckList items={[
                      'Hero com título, subtítulo e CTA',
                      'Estatísticas de destaque (números)',
                      'Lista de benefícios/funcionalidades',
                      'Planos de assinatura com preços',
                      'Depoimentos de clientes',
                      'Perguntas frequentes (FAQ)',
                      'Botão de WhatsApp para contato',
                      'Formulário de interesse (opcional)',
                    ]} />

                    <TipCard type="success" title="🎉 Configuração completa!">
                      Parabéns! Você completou todas as etapas essenciais:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Conta de revendedor criada</li>
                        <li>Perfil e marca configurados</li>
                        <li>Mercado Pago integrado</li>
                        <li>Planos de assinatura criados</li>
                        <li>Primeiro estabelecimento cadastrado</li>
                        <li>Landing page ativa</li>
                      </ul>
                      <p className="mt-3 font-medium">Agora você pode operar normalmente!</p>
                    </TipCard>

                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 mt-6">
                      <p className="font-semibold text-sm mb-2">🚀 Próximos passos recomendados</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Explore as seções abaixo para aprender sobre gestão avançada e monitoramento.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => scrollToSection('gestao-estabelecimentos')}>
                          Gestão de Estabelecimentos
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => scrollToSection('monitoramento')}>
                          Monitoramento
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => scrollToSection('painel-estabelecimento')}>
                          Painel do Estabelecimento
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* ======================= */}
              {/* SECTION: GESTÃO DE RESTAURANTES */}
              {/* ======================= */}
              <section id="gestao-estabelecimentos" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle>Gestão Avançada de Estabelecimentos</CardTitle>
                        <p className="text-sm text-muted-foreground">Ações do dia a dia como revendedor</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                    <h4 className="font-semibold mb-4">Ações disponíveis por estabelecimento</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <FeatureCard icon={Eye} title="Ver Detalhes" description="Informações completas, pagamentos, administradores" />
                      <FeatureCard icon={ExternalLink} title="Acessar Painel Admin" description="Entrar no painel do estabelecimento como admin" />
                      <FeatureCard icon={Edit} title="Editar Dados" description="Alterar nome, contato, plano" />
                      <FeatureCard icon={Pause} title="Suspender" description="Bloquear cardápio por inadimplência" />
                      <FeatureCard icon={Play} title="Reativar" description="Desbloquear após regularização" />
                      <FeatureCard icon={MessageSquare} title="Enviar Mensagem" description="Contato via WhatsApp ou email" />
                      <FeatureCard icon={Key} title="Resetar Senha" description="Gerar nova senha para admin" />
                      <FeatureCard icon={Link2} title="Gerar Link de Pagamento" description="Novo link de assinatura Mercado Pago" />
                    </div>

                    <h4 className="font-semibold mt-8 mb-4">Suspensão e reativação</h4>
                    <p>Quando um estabelecimento é suspenso:</p>
                    <CheckList items={[
                      'O cardápio público exibe mensagem de indisponibilidade',
                      'Clientes não conseguem fazer pedidos',
                      'O painel admin continua acessível ao proprietário',
                      'O proprietário vê aviso de regularização',
                    ]} />

                    <p className="mt-4">A suspensão pode ocorrer:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li><strong>Automaticamente:</strong> quando pagamento falha no Mercado Pago</li>
                      <li><strong>Manualmente:</strong> quando você clica em "Suspender" no painel</li>
                    </ul>

                    <p className="mt-4">Para reativar:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li><strong>Automático:</strong> após pagamento bem-sucedido (via webhook)</li>
                      <li><strong>Manual:</strong> clique em "Ativar" nos detalhes do estabelecimento</li>
                    </ul>

                    <TipCard type="info" title="Comunicação proativa">
                      Antes de suspender manualmente, envie uma mensagem via WhatsApp 
                      lembrando o proprietário sobre o pagamento pendente. Isso evita 
                      surpresas e mantém um bom relacionamento.
                    </TipCard>
                  </CardContent>
                </Card>
              </section>

              {/* ======================= */}
              {/* SECTION: MONITORAMENTO */}
              {/* ======================= */}
              <section id="monitoramento" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <BarChart3 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle>Monitoramento e Relatórios</CardTitle>
                        <p className="text-sm text-muted-foreground">Acompanhe a saúde do seu negócio</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                    <h4 className="font-semibold mb-4">Dashboard do Revendedor</h4>
                    <p>Na tela inicial do painel (<code>/reseller</code>), você encontra:</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 my-4">
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-primary">24</p>
                        <p className="text-xs text-muted-foreground">Total de Estabelecimentos</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-emerald-600">18</p>
                        <p className="text-xs text-muted-foreground">Ativos</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-600">4</p>
                        <p className="text-xs text-muted-foreground">Em Trial</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-amber-600">2</p>
                        <p className="text-xs text-muted-foreground">Suspensos</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-primary">R$ 3.200</p>
                        <p className="text-xs text-muted-foreground">Receita Mensal</p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-muted-foreground">R$ 3.600</p>
                        <p className="text-xs text-muted-foreground">Receita Potencial</p>
                      </div>
                    </div>

                    <h4 className="font-semibold mt-8 mb-4">Página de Relatórios</h4>
                    <p>Em <code>/reseller/reports</code>, você encontra análises mais detalhadas:</p>
                    <CheckList items={[
                      'Gráfico de evolução de receita (últimos meses)',
                      'Distribuição de estabelecimentos por status (pizza)',
                      'Lista de pagamentos recentes',
                      'Taxa de conversão Trial → Pagante',
                      'Churn rate (taxa de cancelamento)',
                    ]} />

                    <h4 className="font-semibold mt-8 mb-4">Página de Mensalidades</h4>
                    <p>Em <code>/reseller/subscriptions</code>, gerencie:</p>
                    <CheckList items={[
                      'Seus planos de assinatura',
                      'Histórico de todos os pagamentos',
                      'Status de cada transação',
                      'ID do Mercado Pago (para conferência)',
                    ]} />

                    <TipCard type="info" title="Rotina recomendada">
                      Acesse o Dashboard diariamente para identificar:
                      <ul className="list-disc list-inside mt-2">
                        <li>Estabelecimentos com trial acabando (convertê-los)</li>
                        <li>Pagamentos pendentes (cobrar antes de suspender)</li>
                        <li>Novos leads da landing page</li>
                      </ul>
                    </TipCard>
                  </CardContent>
                </Card>
              </section>

              {/* ======================= */}
              {/* SECTION: PAINEL RESTAURANTE */}
              {/* ======================= */}
              <section id="painel-estabelecimento" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <LayoutDashboard className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle>Painel do Estabelecimento</CardTitle>
                        <p className="text-sm text-muted-foreground">O que seu cliente pode fazer</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                    <p>
                      Cada estabelecimento tem seu próprio painel administrativo. O proprietário 
                      (ou você, como revendedor) pode acessar e gerenciar tudo.
                    </p>

                    <h4 className="font-semibold mt-6 mb-4">Funcionalidades do painel admin</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <FeatureCard icon={LayoutDashboard} title="Dashboard" description="Resumo de vendas, pedidos e métricas do dia" />
                      <FeatureCard icon={ClipboardList} title="Pedidos" description="Kanban de pedidos com status e ações" />
                      <FeatureCard icon={Package} title="Produtos" description="Cadastro de itens com foto, preço e descrição" />
                      <FeatureCard icon={Layers} title="Categorias" description="Organização do cardápio por categorias" />
                      <FeatureCard icon={List} title="Adicionais" description="Grupos de opções (tamanhos, extras, etc)" />
                      <FeatureCard icon={MapPin} title="Zonas de Entrega" description="Bairros atendidos e taxas por região" />
                      <FeatureCard icon={Clock} title="Horários" description="Dias e horários de funcionamento" />
                      <FeatureCard icon={Percent} title="Cupons" description="Descontos promocionais" />
                      <FeatureCard icon={UtensilsCrossed} title="PDV (Mesas)" description="Sistema de ponto de venda para atendimento local" />
                      <FeatureCard icon={ChefHat} title="Cozinha" description="Tela para preparo com PIN de acesso" />
                      <FeatureCard icon={Users} title="Garçons" description="Cadastro de garçons com PIN" />
                      <FeatureCard icon={Settings} title="Configurações" description="Nome, cores, logo, PIX, WhatsApp" />
                    </div>

                    <h4 className="font-semibold mt-8 mb-4">Cardápio público do estabelecimento</h4>
                    <p>
                      O cardápio fica disponível publicamente na URL do slug escolhido:
                    </p>
                    <CodeBlock label="Exemplo de URL do cardápio">
                      https://seusite.com/pizzaria-bella-napoli
                    </CodeBlock>

                    <p className="mt-4">O cliente final pode:</p>
                    <CheckList items={[
                      'Navegar pelo cardápio por categoria',
                      'Ver fotos e descrições dos produtos',
                      'Adicionar itens ao carrinho',
                      'Escolher adicionais (extras, tamanhos)',
                      'Aplicar cupons de desconto',
                      'Finalizar pedido com dados de entrega',
                      'Escolher forma de pagamento',
                      'Acompanhar status do pedido',
                      'Instalar como PWA no celular',
                    ]} />

                    <TipCard type="success" title="PWA Instalável">
                      O cardápio funciona como um aplicativo. Quando o cliente acessa pelo celular, 
                      aparece a opção de "Adicionar à tela inicial". Funciona offline para visualização!
                    </TipCard>
                  </CardContent>
                </Card>
              </section>

              {/* ======================= */}
              {/* SECTION: FAQ */}
              {/* ======================= */}
              <section id="faq" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <HelpCircle className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle>Perguntas Frequentes</CardTitle>
                        <p className="text-sm text-muted-foreground">Dúvidas comuns respondidas</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="item-1">
                        <AccordionTrigger className="text-sm text-left">
                          O que acontece quando um pagamento falha?
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground">
                          O sistema recebe a notificação do Mercado Pago via webhook e atualiza o status 
                          do estabelecimento para "Suspenso". O cardápio fica indisponível para clientes finais 
                          até que o pagamento seja regularizado. O proprietário continua tendo acesso ao 
                          painel admin e vê um aviso sobre a situação.
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="item-2">
                        <AccordionTrigger className="text-sm text-left">
                          Como reativar um estabelecimento suspenso?
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground">
                          Se o pagamento for regularizado automaticamente (nova tentativa do MP), o sistema 
                          reativa sozinho via webhook. Para reativação manual, acesse os detalhes do 
                          estabelecimento e clique em "Ativar Estabelecimento" após confirmar o recebimento.
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="item-3">
                        <AccordionTrigger className="text-sm text-left">
                          Posso alterar o plano de um estabelecimento?
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground">
                          Sim! Na página de detalhes do estabelecimento, você pode alterar o plano vinculado. 
                          Se houver uma assinatura ativa no Mercado Pago, será necessário cancelar a atual 
                          e criar uma nova com o valor atualizado.
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="item-4">
                        <AccordionTrigger className="text-sm text-left">
                          O webhook do Mercado Pago não está funcionando
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground">
                          Verifique: 1) Se a URL do webhook está correta nas configurações do MP; 
                          2) Se os eventos "Pagamentos" e "Assinaturas" estão selecionados; 
                          3) Se o Access Token está correto no sistema. Você pode testar enviando uma 
                          notificação de teste pelo painel do Mercado Pago.
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="item-5">
                        <AccordionTrigger className="text-sm text-left">
                          Como funciona o período de trial?
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground">
                          O trial é definido por plano (em dias). Durante esse período, o estabelecimento 
                          funciona normalmente sem cobrança. Ao final, o sistema tenta realizar a primeira 
                          cobrança. Se não houver forma de pagamento cadastrada ou o pagamento falhar, 
                          o estabelecimento é suspenso.
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="item-6">
                        <AccordionTrigger className="text-sm text-left">
                          Posso ter mais de uma landing page?
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground">
                          Atualmente, cada revendedor tem uma única landing page. Se você precisa de 
                          páginas diferentes para nichos específicos, considere criar múltiplas contas 
                          de revendedor ou entre em contato com o suporte para soluções personalizadas.
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="item-7">
                        <AccordionTrigger className="text-sm text-left">
                          Como resetar a senha de um administrador?
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground">
                          Acesse os detalhes do estabelecimento, encontre o administrador na lista e clique 
                          em "Resetar Senha". Uma nova senha temporária será gerada e você poderá 
                          compartilhá-la com o proprietário.
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="item-8">
                        <AccordionTrigger className="text-sm text-left">
                          É possível personalizar as cores de cada estabelecimento?
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground">
                          Sim! Cada estabelecimento tem suas próprias configurações de cores no painel admin. 
                          O proprietário pode definir cor primária, secundária e de destaque, além de 
                          fazer upload do logo.
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="item-9">
                        <AccordionTrigger className="text-sm text-left">
                          Posso acessar o painel de qualquer estabelecimento?
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground">
                          Sim! Como revendedor, você tem acesso a todos os estabelecimentos que criou. 
                          Na página de detalhes do estabelecimento, clique em "Acessar Admin" para entrar 
                          no painel como se fosse o proprietário.
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="item-10">
                        <AccordionTrigger className="text-sm text-left">
                          Como altero o slug de um estabelecimento?
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-foreground">
                          Por questões técnicas e de SEO, o slug não pode ser alterado após a criação. 
                          Se for absolutamente necessário mudar, você precisaria criar um novo estabelecimento 
                          e migrar os dados manualmente.
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <div className="mt-8 p-4 bg-muted/50 rounded-xl">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Precisa de Mais Ajuda?
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Se você não encontrou a resposta que procura, entre em contato:
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Button variant="outline" size="sm" className="gap-2">
                          <Mail className="h-4 w-4" />
                          suporte@sistema.com
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Phone className="h-4 w-4" />
                          WhatsApp
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>
            </div>
          </div>

          {/* Back to Top Button */}
          {showBackToTop && (
            <Button
              variant="secondary"
              size="icon"
              className="fixed bottom-6 right-6 rounded-full shadow-lg z-50"
              onClick={scrollToTop}
            >
              <ChevronUp className="h-5 w-5" />
            </Button>
          )}
        </main>
      </div>
    </>
  );
}
