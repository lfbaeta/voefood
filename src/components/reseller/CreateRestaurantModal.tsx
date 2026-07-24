import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ExternalLink, Copy, CheckCircle2, MessageCircle, Eye, EyeOff } from 'lucide-react';
import { useCreateRestaurant, useCurrentReseller } from '@/hooks/useReseller';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';
import { useCreateMPSubscription } from '@/hooks/useMercadoPago';
import { useToast } from '@/hooks/use-toast';
import { SubscriptionStatus } from '@/types/reseller';
import { supabase } from '@/integrations/supabase/client';
import { RESERVED_SUBDOMAINS, buildRestaurantUrl } from '@/lib/getSubdomain';
import { BUSINESS_TYPE_LIST, type BusinessType } from '@/lib/businessTypePresets';
import { getSubtypes } from '@/lib/businessCapabilities';
import { getSeedsForType } from '@/lib/businessSeeds';

interface CreateRestaurantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRestaurantModal({ open, onOpenChange }: CreateRestaurantModalProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [businessType, setBusinessType] = useState<BusinessType>('restaurant');
  const [businessSubtype, setBusinessSubtype] = useState<string>('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [customMonthlyFee, setCustomMonthlyFee] = useState('99.90');
  const [payerEmail, setPayerEmail] = useState('');
  const [createSubscription, setCreateSubscription] = useState(false);
  const [seedMenu, setSeedMenu] = useState(true);
  const [createdInitPoint, setCreatedInitPoint] = useState<string | null>(null);
  const [createdRestaurant, setCreatedRestaurant] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const createRestaurant = useCreateRestaurant();
  const createMPSubscription = useCreateMPSubscription();
  const { data: reseller } = useCurrentReseller();
  const { data: plans } = useSubscriptionPlans();
  const { toast } = useToast();

  const activePlans = plans?.filter(p => p.is_active) || [];
  const mpEnabled = reseller?.mp_integration_enabled;

  const selectedPlan = activePlans.find(p => p.id === selectedPlanId);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value));
    }
  };

  const getMonthlyFee = () => {
    if (selectedPlan) return selectedPlan.monthly_fee;
    return parseFloat(customMonthlyFee) || 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !slug.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome e slug são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (RESERVED_SUBDOMAINS.has(slug.trim().toLowerCase())) {
      toast({
        title: 'Slug reservado',
        description: `"${slug}" é um identificador reservado. Escolha outro.`,
        variant: 'destructive',
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ownerEmail.trim())) {
      toast({
        title: 'Email inválido',
        description: 'Informe um email válido para o proprietário.',
        variant: 'destructive',
      });
      return;
    }

    if (ownerPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (createSubscription && !payerEmail.trim()) {
      toast({
        title: 'Erro',
        description: 'E-mail do pagador é obrigatório para criar assinatura',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const restaurant = await createRestaurant.mutateAsync({
        name: name.trim(),
        slug: slug.trim(),
        owner_name: ownerName.trim() || null,
        phone: phone.trim() || null,
        monthly_fee: getMonthlyFee(),
        trial_days: 0,
        is_active: true,
        subscription_status: 'trial' as SubscriptionStatus,
        subscription_start_date: new Date().toISOString(),
        subscription_end_date: null,
        plan_id: selectedPlanId || null,
        business_type: businessType,
        business_subtype: businessSubtype || null,
      });

      // Popular cardápio de exemplo (opcional)
      if (seedMenu) {
        try {
          const seeds = getSeedsForType(businessType);
          await supabase.functions.invoke('seed-restaurant-menu', {
            body: { restaurantId: restaurant.id, seeds },
          });
        } catch (seedErr) {
          console.warn('Falha ao popular cardápio de exemplo:', seedErr);
        }
      }


      // Create owner admin user
      const { data: adminData, error: adminError } = await supabase.functions.invoke(
        'create-restaurant-admin',
        {
          body: {
            email: ownerEmail.trim(),
            password: ownerPassword,
            restaurantId: restaurant.id,
            isOwner: true,
          },
        }
      );

      if (adminError || (adminData && (adminData as any).error)) {
        const msg = (adminData as any)?.error || adminError?.message || 'Erro ao criar acesso do proprietário';
        toast({
          title: 'Estabelecimento criado, mas falha no acesso',
          description: msg,
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      const credentials = { email: ownerEmail.trim(), password: ownerPassword };
      setCreatedCredentials(credentials);

      // Send credentials email (best-effort)
      try {
        const loginUrl = `${window.location.origin}/auth`;
        await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'restaurant-owner-credentials',
            recipientEmail: credentials.email,
            idempotencyKey: `owner-credentials-${restaurant.id}`,
            templateData: {
              ownerName: ownerName.trim() || 'Proprietário',
              restaurantName: restaurant.name,
              email: credentials.email,
              password: credentials.password,
              loginUrl,
            },
          },
        });
      } catch (emailErr) {
        console.warn('Email de credenciais não enviado:', emailErr);
      }

      // Create Mercado Pago subscription if enabled
      if (createSubscription && mpEnabled && reseller && restaurant?.id) {
        try {
          const result = await createMPSubscription.mutateAsync({
            restaurantId: restaurant.id,
            payerEmail: payerEmail.trim(),
            resellerId: reseller.id,
          });

          if (result.initPoint) {
            setCreatedInitPoint(result.initPoint);
            setCreatedRestaurant({ ...restaurant, owner_name: ownerName, phone });
            toast({
              title: 'Estabelecimento e assinatura criados!',
              description: 'Envie o link de pagamento ao cliente.',
            });
            setSubmitting(false);
            return; // Don't close modal yet - show the payment link
          }
        } catch (mpError) {
          toast({
            title: 'Estabelecimento criado',
            description: 'Mas houve um erro ao criar a assinatura. Tente novamente nos detalhes.',
            variant: 'destructive',
          });
        }
      }

      // Show credentials confirmation screen (no MP link)
      setCreatedRestaurant({ ...restaurant, owner_name: ownerName, phone });
      toast({
        title: 'Estabelecimento criado!',
        description: 'Envie os dados de acesso ao cliente.',
      });
      setSubmitting(false);
    } catch (error: any) {
      toast({
        title: 'Erro ao criar estabelecimento',
        description: error.message || 'Ocorreu um erro ao criar o estabelecimento.',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const resetForm = () => {
    setName('');
    setSlug('');
    setBusinessType('restaurant');
    setBusinessSubtype('');
    setOwnerName('');
    setPhone('');
    setOwnerEmail('');
    setOwnerPassword('');
    setShowPassword(false);
    setSelectedPlanId('');
    setCustomMonthlyFee('99.90');
    setPayerEmail('');
    setCreateSubscription(false);
    setSeedMenu(true);
    setCreatedInitPoint(null);
    setCreatedRestaurant(null);
    setCreatedCredentials(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const copyPaymentLink = async () => {
    if (createdInitPoint) {
      await navigator.clipboard.writeText(createdInitPoint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Link copiado!',
        description: 'Envie este link ao cliente para pagamento.',
      });
    }
  };

  const sendViaWhatsApp = async () => {
    if (!createdRestaurant) return;
    
    const ownerNameForMessage = createdRestaurant.owner_name || 'cliente';
    const loginUrl = `${window.location.origin}/auth`;
    const publicUrl = buildRestaurantUrl(createdRestaurant.slug);
    const credsBlock = createdCredentials
      ? `\n\n🔐 *Acesso ao painel:*\nLogin: ${loginUrl}\nEmail: ${createdCredentials.email}\nSenha: ${createdCredentials.password}\n\n_Recomendamos alterar a senha após o primeiro acesso._`
      : '';
    const linkBlock = `\n\n🔗 *Link do seu cardápio:*\n${publicUrl}`;
    const paymentBlock = createdInitPoint
      ? `\n\n💳 *Link de Pagamento:*\n${createdInitPoint}\n\n💰 *Valor:* ${formatCurrency(getMonthlyFee())}/mês\n\nApós a confirmação do pagamento, seu acesso será liberado automaticamente.`
      : '';
    const message = `Olá${ownerNameForMessage !== 'cliente' ? ` ${ownerNameForMessage}` : ''}! 👋

Seu estabelecimento *${createdRestaurant.name}* foi cadastrado em nosso sistema.${linkBlock}${credsBlock}${paymentBlock}

Qualquer dúvida, estou à disposição! 🙂`;
    
    const formattedPhone = createdRestaurant.phone ? createdRestaurant.phone.replace(/\D/g, '') : '';
    const phoneWithCountry = formattedPhone.length >= 10 ? `55${formattedPhone}` : formattedPhone;
    
    const whatsappUrl = phoneWithCountry
      ? `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');

    // Log communication
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && createdRestaurant.id) {
        await supabase
          .from('communication_logs')
          .insert({
            restaurant_id: createdRestaurant.id,
            type: 'whatsapp',
            message: `Link de pagamento enviado via WhatsApp na criação do estabelecimento`,
            sent_by: user.id,
          });
      }
    } catch (error) {
      console.error('Erro ao registrar comunicação:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Show confirmation screen after creation
  if (createdRestaurant && (createdCredentials || createdInitPoint)) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Estabelecimento Criado!
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {createdCredentials && (
              <div className="space-y-2 p-3 border rounded-lg bg-muted/40">
                <p className="text-sm font-medium">Acesso do proprietário</p>
                <div className="space-y-1 text-sm font-mono">
                  <div><span className="text-muted-foreground">Email:</span> {createdCredentials.email}</div>
                  <div><span className="text-muted-foreground">Senha:</span> {createdCredentials.password}</div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Um email com estas credenciais foi enviado ao proprietário (se a infraestrutura de email estiver configurada).
                </p>
              </div>
            )}

            {createdInitPoint && (
              <>
                <p className="text-sm text-muted-foreground">
                  Link de pagamento da primeira mensalidade:
                </p>
                <div className="flex gap-2">
                  <Input
                    value={createdInitPoint}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyPaymentLink}
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </>
            )}

            <div className="flex flex-col gap-2">
              <Button
                onClick={sendViaWhatsApp}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar via WhatsApp
              </Button>
              
              <div className="flex gap-2">
                {createdInitPoint && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    asChild
                  >
                    <a href={createdInitPoint} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir
                    </a>
                  </Button>
                )}
                <Button onClick={handleClose} className="flex-1">
                  Concluir
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Estabelecimento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Estabelecimento</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex: Pizzaria do João"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug / Identificador</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="pizzaria-do-joao"
              required
            />
            {slug && (
              <p className="text-xs text-muted-foreground">
                URL final: <span className="font-mono">{buildRestaurantUrl(slug)}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Use apenas letras minúsculas, números e hífens. Cada restaurante ganha seu próprio subdomínio (ex.: <span className="font-mono">{slug || 'seu-estabelecimento'}.peddioficial.lovable.app</span>).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessType">Tipo de Estabelecimento</Label>
            <Select value={businessType} onValueChange={(v) => { setBusinessType(v as BusinessType); setBusinessSubtype(''); }}>
              <SelectTrigger id="businessType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPE_LIST.map((bt) => (
                  <SelectItem key={bt.id} value={bt.id}>
                    {bt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Define os módulos e textos do sistema (ex.: pizzaria mostra sabores/bordas; farmácia mostra receita e validade).
            </p>
          </div>

          {getSubtypes(businessType).length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="businessSubtype">Subtipo</Label>
              <Select value={businessSubtype || '__none__'} onValueChange={(v) => setBusinessSubtype(v === '__none__' ? '' : v)}>
                <SelectTrigger id="businessSubtype">
                  <SelectValue placeholder="Escolha um subtipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem subtipo</SelectItem>
                  {getSubtypes(businessType).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Refina o comportamento (ex.: self-service ativa venda por kg; hortifrúti idem).
              </p>
            </div>
          )}

          <div className="flex items-start justify-between rounded-lg border border-border p-3 bg-muted/30">
            <div className="space-y-0.5 pr-3">
              <Label htmlFor="seedMenu" className="cursor-pointer">
                Popular com cardápio de exemplo
              </Label>
              <p className="text-xs text-muted-foreground">
                Cria categorias e produtos prontos para o tipo escolhido. O cliente pode apagar tudo depois.
              </p>
            </div>
            <Switch id="seedMenu" checked={seedMenu} onCheckedChange={setSeedMenu} />
          </div>

          {/* Contact Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ownerName">Nome do Proprietário</Label>
              <Input
                id="ownerName"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="João da Silva"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          {/* Owner Access */}
          <div className="space-y-3 p-3 border rounded-lg">
            <p className="text-sm font-medium">Acesso do Proprietário</p>
            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Email *</Label>
              <Input
                id="ownerEmail"
                type="email"
                value={ownerEmail}
                onChange={(e) => {
                  setOwnerEmail(e.target.value);
                  if (!payerEmail) setPayerEmail(e.target.value);
                }}
                placeholder="dono@estabelecimento.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerPassword">Senha *</Label>
              <div className="relative">
                <Input
                  id="ownerPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Credenciais serão enviadas ao cliente por WhatsApp e email.
              </p>
            </div>
          </div>

          {/* Plan Selection */}
          {activePlans.length > 0 ? (
            <div className="space-y-2">
              <Label>Plano de Assinatura</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Personalizado</SelectItem>
                  {activePlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - {formatCurrency(plan.monthly_fee)}/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPlan && selectedPlan.description && (
                <p className="text-xs text-muted-foreground">
                  {selectedPlan.description}
                </p>
              )}
            </div>
          ) : null}

          {/* Custom pricing (shown when no plan selected or no plans exist) */}
          {(!selectedPlanId || selectedPlanId === 'custom' || activePlans.length === 0) && (
            <div className="space-y-2">
              <Label htmlFor="monthlyFee">Mensalidade (R$)</Label>
              <Input
                id="monthlyFee"
                type="number"
                step="0.01"
                min="0"
                value={customMonthlyFee}
                onChange={(e) => setCustomMonthlyFee(e.target.value)}
                required
              />
            </div>
          )}

          {mpEnabled && (
            <>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="createSubscription" className="font-medium">
                    Criar assinatura automática
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Gera link de pagamento via Mercado Pago
                  </p>
                </div>
                <Switch
                  id="createSubscription"
                  checked={createSubscription}
                  onCheckedChange={setCreateSubscription}
                />
              </div>

              {createSubscription && (
                <div className="space-y-2">
                  <Label htmlFor="payerEmail">E-mail do Pagador</Label>
                  <Input
                    id="payerEmail"
                    type="email"
                    value={payerEmail}
                    onChange={(e) => setPayerEmail(e.target.value)}
                    placeholder="dono@estabelecimento.com"
                    required={createSubscription}
                  />
                  <p className="text-xs text-muted-foreground">
                    E-mail do dono do estabelecimento para receber cobranças
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={submitting || createRestaurant.isPending || createMPSubscription.isPending}
            >
              {(submitting || createRestaurant.isPending || createMPSubscription.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Criar Estabelecimento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
