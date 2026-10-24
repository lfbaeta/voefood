import { useParams, useNavigate } from 'react-router-dom';
import { useLandingPageData } from '@/hooks/useLandingPage';
import { Button } from '@/components/ui/button';
import { 
  MessageCircle,
  Loader2,
  LogIn
} from 'lucide-react';
import { useState } from 'react';
import { HeroSection } from '@/components/landing/HeroSection';
import { ComparisonSection } from '@/components/landing/ComparisonSection';
import { StatsSection } from '@/components/landing/StatsSection';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { CheckoutModal } from '@/components/landing/CheckoutModal';

export default function Landing() {
  const { resellerSlug } = useParams<{ resellerSlug: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useLandingPageData(resellerSlug);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  // Dados de exemplo para quando não há revendedor configurado
  const defaultReseller = {
    id: 'demo',
    name: 'CardápioDigital',
    company_name: 'CardápioDigital',
    landing_page_title: 'Cardápio Digital Completo para seu Negócio',
    landing_page_subtitle: 'Venda mais, pague menos taxas. Sistema completo de pedidos online para restaurantes, bares e lanchonetes.',
    landing_page_whatsapp: '5511999999999',
    landing_page_email: 'contato@cardapiodigital.com',
    landing_page_logo: null,
    primary_color: '28 100% 65%',
    secondary_color: '220 10% 20%',
    landing_testimonials: [
      {
        id: '1',
        name: 'João Silva',
        business: 'Pizzaria do João',
        text: 'Aumentei minhas vendas em 40% desde que comecei a usar o sistema. Sem taxas abusivas!',
        rating: 5,
        image: null
      },
      {
        id: '2',
        name: 'Maria Santos',
        business: 'Hamburgueria da Maria',
        text: 'O melhor investimento que fiz para meu negócio. Atendimento excelente e sistema super fácil.',
        rating: 5,
        image: null
      },
      {
        id: '3',
        name: 'Carlos Oliveira',
        business: 'Bar do Carlos',
        text: 'Finalmente um sistema que entende as necessidades do pequeno empreendedor.',
        rating: 5,
        image: null
      }
    ],
    landing_faq: [
      {
        id: '1',
        question: 'Quanto tempo leva para configurar?',
        answer: 'Em menos de 24 horas seu cardápio digital estará pronto para receber pedidos.'
      },
      {
        id: '2',
        question: 'Preciso de conhecimento técnico?',
        answer: 'Não! O sistema foi feito para ser simples e intuitivo. Qualquer pessoa consegue usar.'
      },
      {
        id: '3',
        question: 'Posso cancelar a qualquer momento?',
        answer: 'Sim, não há fidelidade. Você pode cancelar quando quiser sem multas.'
      },
      {
        id: '4',
        question: 'Como recebo os pagamentos?',
        answer: 'Os pagamentos via Pix caem direto na sua conta, sem intermediários.'
      }
    ],
    landing_stats: {
      restaurants: 500,
      orders: 50000,
      satisfaction: 98,
      support: 24
    }
  };

  const defaultPlans = [
    {
      id: 'basic',
      name: 'Básico',
      description: 'Ideal para começar',
      monthly_fee: 49.90,
      setup_fee: 0,
      trial_days: 7,
      features: ['Cardápio digital ilimitado', 'Pedidos via WhatsApp', 'Suporte por email'],
      is_popular: false,
      is_active: true,
    },
    {
      id: 'professional',
      name: 'Profissional',
      description: 'O mais escolhido',
      monthly_fee: 99.90,
      setup_fee: 0,
      trial_days: 14,
      features: ['Tudo do Básico', 'Gestão de mesas (PDV)', 'Relatórios avançados', 'Suporte prioritário', 'Painel da cozinha'],
      is_popular: true,
      is_active: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Para grandes operações',
      monthly_fee: 199.90,
      setup_fee: 0,
      trial_days: 30,
      features: ['Tudo do Profissional', 'Múltiplas unidades', 'API de integração', 'Gerente dedicado', 'Personalização completa'],
      is_popular: false,
      is_active: true,
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Usa dados reais se disponíveis, senão usa dados de exemplo
  const reseller = data?.reseller || defaultReseller;
  const plans = data?.plans?.length ? data.plans : defaultPlans;
  
  const primaryColor = reseller.primary_color || '28 100% 65%';
  const whatsappLink = 'https://wa.me/5513991424545?text=' + encodeURIComponent('Estou vindo do Site Voefood e queria mais informações.');

  const testimonials = (reseller as any).landing_testimonials || defaultReseller.landing_testimonials;
  const faq = (reseller as any).landing_faq || defaultReseller.landing_faq;
  const stats = (reseller as any).landing_stats || defaultReseller.landing_stats;

  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan);
    setCheckoutOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {reseller.landing_page_logo ? (
              <img 
                src={reseller.landing_page_logo} 
                alt={reseller.company_name || reseller.name}
                className="h-10 w-auto object-contain"
              />
            ) : (
              <div 
                className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: `hsl(${primaryColor})` }}
              >
                {(reseller.company_name || reseller.name).charAt(0)}
              </div>
            )}
            <span className="font-semibold text-lg hidden sm:block">
              {reseller.company_name || reseller.name}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <a href="#comparativo" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden md:block">
              Compare
            </a>
            <a href="#precos" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Preços
            </a>
            <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden md:block">
              FAQ
            </a>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/auth')}
            >
              <LogIn className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Acessar Sistema</span>
              <span className="sm:hidden">Entrar</span>
            </Button>
            {whatsappLink && (
              <Button asChild size="sm" style={{ backgroundColor: `hsl(${primaryColor})` }}>
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Falar com Vendas</span>
                </a>
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <HeroSection 
        title={reseller.landing_page_title || 'Cardápio Digital Completo para seu Negócio'}
        subtitle={reseller.landing_page_subtitle || 'Venda mais, pague menos taxas. Sistema completo de pedidos online.'}
        primaryColor={primaryColor}
        whatsappLink={whatsappLink}
        onCtaClick={() => document.getElementById('precos')?.scrollIntoView({ behavior: 'smooth' })}
        stats={{
          restaurants: stats?.restaurants,
          revenue: stats?.revenue,
          satisfaction: stats?.satisfaction,
        }}
      />

      {/* Stats Section */}
      <StatsSection 
        stats={stats}
        primaryColor={primaryColor}
      />

      {/* Comparison Section */}
      <ComparisonSection 
        primaryColor={primaryColor} 
        lowestPlanPrice={plans.length > 0 ? Math.min(...plans.filter(p => p.is_active !== false).map(p => p.monthly_fee)) : undefined}
      />

      {/* Testimonials Section */}
      <TestimonialsSection 
        testimonials={testimonials}
        primaryColor={primaryColor}
      />

      {/* Pricing Section */}
      <PricingSection 
        plans={plans.map(p => ({
          ...p,
          features: p.features || []
        }))}
        primaryColor={primaryColor}
        onSelectPlan={handleSelectPlan}
      />

      {/* FAQ Section */}
      <FAQSection 
        faqs={faq}
        primaryColor={primaryColor}
      />

      {/* Final CTA Section */}
      <section 
        className="py-20"
        style={{ backgroundColor: `hsl(${primaryColor})` }}
      >
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            Pronto para revolucionar suas vendas?
          </h2>
          <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8">
            Entre em contato agora e comece a vender sem taxas abusivas
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {whatsappLink && (
              <Button 
                size="lg" 
                variant="secondary"
                className="text-lg px-8"
                asChild
              >
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Falar no WhatsApp
                </a>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-foreground text-background">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                {reseller.landing_page_logo ? (
                  <img 
                    src={reseller.landing_page_logo} 
                    alt={reseller.company_name || reseller.name}
                    className="h-10 w-auto object-contain brightness-0 invert"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-xl bg-background/20 flex items-center justify-center font-bold">
                    {(reseller.company_name || reseller.name).charAt(0)}
                  </div>
                )}
                <span className="font-semibold text-lg">
                  {reseller.company_name || reseller.name}
                </span>
              </div>
              <p className="text-background/60 text-sm">
                Sistema completo de cardápio digital e gestão de pedidos para seu restaurante.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Links Úteis</h4>
              <ul className="space-y-2 text-sm text-background/60">
                <li><a href="#comparativo" className="hover:text-background transition-colors">Comparativo</a></li>
                <li><a href="#precos" className="hover:text-background transition-colors">Preços</a></li>
                <li><a href="#faq" className="hover:text-background transition-colors">Perguntas Frequentes</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contato</h4>
              <ul className="space-y-2 text-sm text-background/60">
                {reseller.landing_page_whatsapp && (
                  <li className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    <a 
                      href={whatsappLink!} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-background transition-colors"
                    >
                      WhatsApp
                    </a>
                  </li>
                )}
                {reseller.landing_page_email && (
                  <li className="flex items-center gap-2">
                    <span>📧</span>
                    <a 
                      href={`mailto:${reseller.landing_page_email}`}
                      className="hover:text-background transition-colors"
                    >
                      {reseller.landing_page_email}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>
          <div className="border-t border-background/10 pt-8 text-center text-sm text-background/40">
            <p>© {new Date().getFullYear()} {reseller.company_name || reseller.name}. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>

      {/* WhatsApp Floating Button */}
      {whatsappLink && (
        <a 
          href={whatsappLink} 
          target="_blank" 
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform animate-pulse"
        >
          <MessageCircle className="h-7 w-7 text-white" />
        </a>
      )}

      {/* Checkout Modal */}
      <CheckoutModal 
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        plan={selectedPlan}
        primaryColor={primaryColor}
        resellerId={reseller.id || 'demo'}
        whatsappLink={whatsappLink}
        mpEnabled={(reseller as any).mp_integration_enabled || false}
      />
    </div>
  );
}
