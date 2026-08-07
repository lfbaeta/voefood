import { buildBasePath, getCurrentRootDomain } from '@/lib/getSubdomain';
import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useSlug, useBasePath } from '@/hooks/useSlug';
import { Helmet } from 'react-helmet-async';
import { Eye, EyeOff, Loader2, Mail, Lock, UtensilsCrossed, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { z } from 'zod';
import { useHasResellerSetupStatus } from '@/hooks/useHasResellerSetupStatus';

const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Email inválido' }),
  password: z.string().min(6, { message: 'Senha deve ter pelo menos 6 caracteres' }),
});

const signupSchema = z.object({
  email: z.string().trim().email({ message: 'Email inválido' }),
  password: z.string().min(6, { message: 'Senha deve ter pelo menos 6 caracteres' }),
  confirmPassword: z.string().min(6, { message: 'Confirmação de senha é obrigatória' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type AuthMode = 'login' | 'signup' | 'forgot';

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const slug = useSlug();
  const { toast } = useToast();
  const { data: hasReseller, isLoading: loadingSetupStatus } = useHasResellerSetupStatus();
  const [mode, setMode] = useState<AuthMode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Apply theme colors dynamically
  useTheme();

  // Determine base paths based on slug
  const basePath = useBasePath(slug);
  const menuPath = basePath || '/';
  const adminPath = slug ? `${basePath}/admin` : null;

  // Function to check roles and redirect accordingly
  const checkRolesAndRedirect = async (userId: string) => {
    try {
      // Se o sistema ainda não tem reseller, redireciona para o setup.
      if (hasReseller === false) {
        setIsLoading(false);
        navigate('/setup');
        return;
      }

      // Check if user is a reseller
      const { data: resellerData, error: resellerError } = await supabase
        .from('resellers')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (resellerError) {
        console.error('Error checking reseller:', resellerError);
      }

      // Check if user is a restaurant admin
      const { data: adminData, error: adminError } = await supabase
        .from('restaurant_admins')
        .select('restaurant_id, restaurants(slug)')
        .eq('user_id', userId)
        .maybeSingle();

      if (adminError) {
        console.error('Error checking restaurant admin:', adminError);
      }

      const adminRestaurantSlug = (adminData?.restaurants as any)?.slug as string | undefined;

      // ============ Contexto: SUBDOMÍNIO de restaurante ============
      if (slug) {
        // Descobre o restaurante alvo pelo slug para checar autorização de super admin/reseller.
        const { data: targetRestaurant } = await supabase
          .from('restaurants')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();

        // Super admin global (app_role = 'admin'): acesso a qualquer restaurante.
        const { data: isSuper } = await supabase.rpc('has_role', {
          _user_id: userId,
          _role: 'admin',
        });
        if (isSuper === true) {
          setIsLoading(false);
          navigate(`${basePath}/admin`);
          return;
        }

        // Reseller dono do restaurante: libera o painel deste restaurante.
        if (resellerData && targetRestaurant?.id) {
          const { data: isResOfThis } = await supabase.rpc('is_reseller_of_restaurant', {
            _user_id: userId,
            _restaurant_id: targetRestaurant.id,
          });
          if (isResOfThis === true) {
            setIsLoading(false);
            navigate(`${basePath}/admin`);
            return;
          }
          // Reseller de outra rede: manda de volta para o painel do revendedor.
          setIsLoading(false);
          await supabase.auth.signOut();
          toast({
            title: 'Restaurante fora da sua rede',
            description: 'Use peddi.online/auth para acessar seu painel de revendedor.',
          });
          window.location.href = `${window.location.protocol}//${getCurrentRootDomain()}/auth`;
          return;
        }

        // Admin do restaurante atual: libera.
        if (adminData && adminRestaurantSlug === slug) {
          setIsLoading(false);
          navigate(`${basePath}/admin`);
          return;
        }

        // Admin de outro restaurante: redireciona para o subdomínio correto.
        if (adminData && adminRestaurantSlug && adminRestaurantSlug !== slug) {
          setIsLoading(false);
          await supabase.auth.signOut();
          toast({
            title: 'Restaurante incorreto',
            description: `Acesse ${adminRestaurantSlug}.${getCurrentRootDomain()}/admin`,
            variant: 'destructive',
          });
          return;
        }

        // Nenhum papel válido para este restaurante.
        setIsLoading(false);
        await supabase.auth.signOut();
        toast({
          title: 'Acesso negado',
          description: 'Sua conta não tem permissão para este restaurante.',
          variant: 'destructive',
        });
        return;
      }


      // ============ Contexto: DOMÍNIO RAIZ (peddi.online) ============
      // Só permite reseller. Admins de restaurante são bloqueados e devem
      // acessar via slug.peddi.online/admin.
      if (resellerData) {
        setIsLoading(false);
        navigate('/reseller');
        return;
      }

      if (adminData && adminRestaurantSlug) {
        setIsLoading(false);
        await supabase.auth.signOut();
        toast({
          title: 'Acesse pelo subdomínio do restaurante',
          description: `O painel do restaurante fica em ${adminRestaurantSlug}.${getCurrentRootDomain()}/admin`,
          variant: 'destructive',
        });
        return;
      }

      // Nenhum papel: acesso negado.
      setIsLoading(false);
      await supabase.auth.signOut();
      toast({
        title: 'Acesso negado',
        description: 'Sua conta não possui permissão para acessar o sistema.',
        variant: 'destructive',
      });
    } catch (error) {
      console.error('Error checking roles:', error);
      setIsLoading(false);
    }
  };

  // Check if already logged in
  useEffect(() => {
    const checkAuth = async () => {
      // Se vier com o parâmetro "direct=true", faz login automático como o admin do restaurante
      const params = new URLSearchParams(location.search);
      if (params.get('direct') === 'true' && slug) {
        setIsLoading(true);
        try {
          // Busca o admin vinculado a este restaurante (pegando o primeiro admin ativo)
          const { data: adminData } = await supabase
            .from('restaurant_admins')
            .select('user_id, restaurant_id')
            .eq('restaurants.slug', slug)
            .limit(1)
            .maybeSingle();

          if (adminData?.user_id) {
            // Em Lovable Cloud, o admin (revendedor ou dono) geralmente já está logado
            // no domínio principal. Se ele já tem uma sessão, verificamos se é o admin esperado.
            const { data: { session } } = await supabase.auth.getSession();
            
            // Se o usuário logado é o admin desse restaurante, ou é um Super Admin (checado no checkRolesAndRedirect)
            // ou se o usuário logado for um revendedor com acesso a esse restaurante, prosseguimos.
            if (session?.user) {
              await checkRolesAndRedirect(session.user.id);
              return;
            }
          }
        } catch (err) {
          console.error('Direct access error:', err);
        }
        setIsLoading(false);
      }

      // Aguarda a verificação do setup-status para evitar redirect errado.
      if (loadingSetupStatus) return;

      // If no resellers exist, redirect to setup immediately
      if (hasReseller === false) {
        navigate('/setup');
        return;
      }

      // Se tem slug na URL, significa que o restaurante existe, vai direto pro login
      // Não precisa verificar se existe revendedor
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await checkRolesAndRedirect(session.user.id);
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === 'SIGNED_IN') {
        // Use setTimeout to defer Supabase calls and prevent deadlock
        setTimeout(() => {
          checkRolesAndRedirect(session.user.id);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, slug, hasReseller, loadingSetupStatus, location.search]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const emailValidation = z.string().email().safeParse(formData.email);
      if (!emailValidation.success) {
        toast({
          title: 'Email inválido',
          description: 'Digite um email válido',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const redirectUrl = slug 
        ? `${window.location.origin}${basePath}/auth`
        : `${window.location.origin}/auth`;

      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        toast({
          title: 'Erro',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Email enviado!',
          description: 'Verifique sua caixa de entrada para redefinir a senha.',
        });
        setMode('login');
      }
    } catch (error) {
      toast({
        title: 'Erro inesperado',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    setIsLoading(true);

    try {
      const validation = signupSchema.safeParse(formData);
      if (!validation.success) {
        toast({
          title: 'Dados inválidos',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        toast({
          title: 'Erro ao criar conta',
          description: error.message,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: 'Conta criada!',
        description: 'Sua conta foi criada com sucesso. Você já pode fazer login.',
      });
      setMode('login');
      setFormData({ email: formData.email, password: '', confirmPassword: '' });
    } catch (error) {
      toast({
        title: 'Erro inesperado',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'forgot') {
      return handleForgotPassword(e);
    }

    if (mode === 'signup') {
      return handleSignup();
    }

    setIsLoading(true);

    try {
      const validation = loginSchema.safeParse(formData);
      if (!validation.success) {
        toast({
          title: 'Dados inválidos',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: 'Erro ao entrar',
            description: 'Email ou senha incorretos',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Erro ao entrar',
            description: error.message,
            variant: 'destructive',
          });
        }
        setIsLoading(false);
        return;
      }

      toast({
        title: 'Bem-vindo!',
        description: 'Login realizado com sucesso',
      });
      
      // Don't reset loading here - let the onAuthStateChange handle navigation
      // The loading will naturally end when the page navigates
    } catch (error) {
      toast({
        title: 'Erro inesperado',
        description: 'Tente novamente mais tarde',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'login': return 'Entrar no Painel';
      case 'signup': return 'Criar Conta';
      case 'forgot': return 'Recuperar Senha';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'login': return 'Acesse sua conta para gerenciar o sistema';
      case 'signup': return 'Preencha os dados para criar sua conta';
      case 'forgot': return 'Digite seu email para receber o link de recuperação';
    }
  };

  const getButtonText = () => {
    switch (mode) {
      case 'login': return 'Entrar';
      case 'signup': return 'Criar Conta';
      case 'forgot': return 'Enviar Link';
    }
  };

  return (
    <>
      <Helmet>
        <title>{getTitle()} - Painel Admin</title>
      </Helmet>

      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <UtensilsCrossed className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>

          {/* Card */}
          <div className="bg-card rounded-3xl shadow-card p-8">
            {(mode === 'forgot' || mode === 'signup') && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setFormData({ email: formData.email, password: '', confirmPassword: '' });
                }}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao login
              </button>
            )}

            <h1 className="text-2xl font-bold text-center text-foreground mb-2">
              {getTitle()}
            </h1>
            <p className="text-center text-muted-foreground mb-8">
              {getSubtitle()}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 h-12 bg-muted/50 border-0 rounded-xl"
                />
              </div>

              {mode !== 'forgot' && (
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Sua senha"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-10 pr-10 h-12 bg-muted/50 border-0 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              )}

              {mode === 'signup' && (
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirme sua senha"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="pl-10 pr-10 h-12 bg-muted/50 border-0 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              )}

              {mode === 'login' && (
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    className="text-primary hover:underline text-sm"
                  >
                    Criar conta
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-primary hover:underline text-sm"
                  >
                    Esqueci minha senha
                  </button>
                </div>
              )}

              <Button
                type="submit"
                size="xl"
                className="w-full rounded-xl"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Aguarde...
                  </>
                ) : (
                  getButtonText()
                )}
              </Button>
            </form>

            {mode === 'login' && (
              <p className="text-center text-muted-foreground text-xs mt-6">
                Não tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-primary hover:underline"
                >
                  Crie uma agora
                </button>
              </p>
            )}

            {mode === 'signup' && (
              <p className="text-center text-muted-foreground text-xs mt-6">
                Já tem uma conta?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-primary hover:underline"
                >
                  Faça login
                </button>
              </p>
            )}
          </div>

          {/* Back to menu */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate(menuPath)}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              ← Voltar ao cardápio
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Auth;
