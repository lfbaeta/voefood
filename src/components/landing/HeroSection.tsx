import { Button } from '@/components/ui/button';
import { ArrowRight, Play, Star, TrendingUp } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import mascotVoeFood from '@/assets/mascote-voe-food.webp';

interface HeroSectionProps {
  title: string;
  subtitle: string;
  primaryColor: string;
  whatsappLink: string;
  onCtaClick: () => void;
  stats?: {
    restaurants?: number;
    revenue?: number;
    satisfaction?: number;
  };
}

function AnimatedCounter({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isVisible, target]);

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString('pt-BR')}{suffix}
    </span>
  );
}

export function HeroSection({ title, subtitle, primaryColor, whatsappLink, onCtaClick, stats }: HeroSectionProps) {
  return (
    <section className="relative lg:min-h-[90vh] flex items-center overflow-hidden pt-20 lg:pt-0">
      {/* Animated gradient background */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          background: `linear-gradient(135deg, hsl(${primaryColor}) 0%, hsl(${primaryColor} / 0.3) 50%, transparent 100%)`,
        }}
      />
      
      {/* Floating shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-20 left-10 w-48 md:w-72 h-48 md:h-72 rounded-full opacity-20 blur-3xl animate-pulse"
          style={{ backgroundColor: `hsl(${primaryColor})` }}
        />
        <div 
          className="absolute bottom-20 right-10 w-64 md:w-96 h-64 md:h-96 rounded-full opacity-10 blur-3xl animate-pulse"
          style={{ backgroundColor: `hsl(${primaryColor})`, animationDelay: '1s' }}
        />
      </div>

      <div className="container mx-auto px-4 py-12 md:py-16 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-6 md:space-y-8 animate-fade-in text-center lg:text-left">
            {/* Trust badges */}
            <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-sm font-medium" style={{ color: `hsl(${primaryColor})` }}>
                <Star className="h-4 w-4 fill-current" />
                <span>4.9/5 avaliação</span>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 text-sm font-medium">
                <TrendingUp className="h-4 w-4" />
                <span>0% de taxas</span>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              {title}
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0">
              {subtitle}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center lg:justify-start">
              <Button 
                size="lg" 
                className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 w-full sm:w-auto"
                style={{ backgroundColor: `hsl(${primaryColor})` }}
                onClick={onCtaClick}
              >
                Começar Agora
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 rounded-xl hover:scale-105 transition-all w-full sm:w-auto"
                onClick={() => window.open(whatsappLink, '_blank')}
              >
                <Play className="mr-2 h-5 w-5" />
                Ver Demo
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 md:gap-6 pt-6 md:pt-8 border-t border-border">
              <div className="text-center">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: `hsl(${primaryColor})` }}>
                  <AnimatedCounter target={stats?.restaurants ?? 500} suffix="+" />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">Restaurantes</p>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: `hsl(${primaryColor})` }}>
                  <AnimatedCounter target={stats?.revenue ?? 50} prefix="R$" suffix="M+" />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">Em Vendas</p>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: `hsl(${primaryColor})` }}>
                  <AnimatedCounter target={stats?.satisfaction ?? 99} suffix="%" />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">Satisfação</p>
              </div>
            </div>
          </div>

          {/* Right Content - Mascote VoeFood */}
          <div className="relative flex justify-center items-center mt-6 lg:mt-0">
            <img
              src={mascotVoeFood}
              alt="Mascote VoeFood com cardápio digital no celular"
              className="w-full max-w-[320px] sm:max-w-[400px] lg:max-w-[500px] h-auto object-contain drop-shadow-2xl transition-transform duration-500 hover:scale-[1.03]"
              loading="eager"
              fetchPriority="high"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
