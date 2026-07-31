import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Loader2, Plus, Pencil, Trash2, Package, Star, X, MessageCircle, Percent
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSubscriptionPlans, useCreatePlan, useUpdatePlan, useDeletePlan } from '@/hooks/useSubscriptionPlans';
import { Checkbox } from '@/components/ui/checkbox';
import { PLAN_FEATURE_GROUPS, ALL_PLAN_FEATURE_IDS } from '@/lib/planFeatures';
import type { SubscriptionPlan } from '@/types/reseller';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ConvenienceFeeType = 'none' | 'percent' | 'fixed' | 'percent_plus_fixed';

interface PlanFormData {
  name: string;
  description: string;
  monthly_fee: string;
  setup_fee: string;
  trial_days: string;
  wa_instances_limit: string;
  ai_image_enhancements_per_month: string;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
  features: string[];
  enabled_features: string[];
  convenience_fee_type: ConvenienceFeeType;
  convenience_fee_percent: string;
  convenience_fee_fixed: string;
  convenience_fee_label: string;
  convenience_fee_description: string;
}

const defaultFormData: PlanFormData = {
  name: '',
  description: '',
  monthly_fee: '99.90',
  setup_fee: '0',
  trial_days: '14',
  wa_instances_limit: '1',
  ai_image_enhancements_per_month: '0',
  is_active: true,
  is_popular: false,
  sort_order: 0,
  features: [],
  enabled_features: [...ALL_PLAN_FEATURE_IDS],
  convenience_fee_type: 'none',
  convenience_fee_percent: '0',
  convenience_fee_fixed: '0',
  convenience_fee_label: 'Taxa de conveniência',
  convenience_fee_description: 'Taxa cobrada pelo processamento do pagamento online (PIX/Cartão).',
};

export function SubscriptionPlansManager() {
  const { data: plans, isLoading } = useSubscriptionPlans();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState<PlanFormData>(defaultFormData);
  const [newFeature, setNewFeature] = useState('');

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setFormData({
      ...defaultFormData,
      sort_order: (plans?.length || 0) + 1,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      monthly_fee: String(plan.monthly_fee),
      setup_fee: String(plan.setup_fee ?? 0),
      trial_days: String(plan.trial_days ?? 14),
      wa_instances_limit: String(plan.wa_instances_limit ?? 1),
      ai_image_enhancements_per_month: String((plan as any).ai_image_enhancements_per_month ?? 0),
      is_active: plan.is_active,
      is_popular: plan.is_popular || false,
      sort_order: plan.sort_order,
      features: plan.features || [],
      enabled_features:
        plan.enabled_features && plan.enabled_features.length > 0
          ? plan.enabled_features
          : [...ALL_PLAN_FEATURE_IDS],
      convenience_fee_type: (plan.convenience_fee_type ?? 'none') as ConvenienceFeeType,
      convenience_fee_percent: String(plan.convenience_fee_percent ?? 0),
      convenience_fee_fixed: String(plan.convenience_fee_fixed ?? 0),
      convenience_fee_label: plan.convenience_fee_label ?? 'Taxa de conveniência',
      convenience_fee_description:
        plan.convenience_fee_description ??
        'Taxa cobrada pelo processamento do pagamento online (PIX/Cartão).',
    });
    setModalOpen(true);
  };

  const handleAddFeature = () => {
    if (newFeature.trim()) {
      setFormData({
        ...formData,
        features: [...formData.features, newFeature.trim()],
      });
      setNewFeature('');
    }
  };

  const handleRemoveFeature = (index: number) => {
    setFormData({
      ...formData,
      features: formData.features.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome do plano é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      const planData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        monthly_fee: parseFloat(formData.monthly_fee) || 0,
        setup_fee: parseFloat(formData.setup_fee) || 0,
        trial_days: parseInt(formData.trial_days) || 0,
        wa_instances_limit: Math.max(1, parseInt(formData.wa_instances_limit) || 1),
        ai_image_enhancements_per_month: Math.max(0, parseInt(formData.ai_image_enhancements_per_month) || 0),
        is_active: formData.is_active,
        is_popular: formData.is_popular,
        sort_order: formData.sort_order,
        features: formData.features.length > 0 ? formData.features : null,
        enabled_features: formData.enabled_features,
        convenience_fee_type: formData.convenience_fee_type,
        convenience_fee_percent: Math.max(0, parseFloat(formData.convenience_fee_percent.replace(',', '.')) || 0),
        convenience_fee_fixed: Math.max(0, parseFloat(formData.convenience_fee_fixed.replace(',', '.')) || 0),
        convenience_fee_label: formData.convenience_fee_label.trim() || 'Taxa de conveniência',
        convenience_fee_description: formData.convenience_fee_description.trim() || 'Taxa cobrada pelo processamento do pagamento online (PIX/Cartão).',
      };

      if (editingPlan) {
        await updatePlan.mutateAsync({ id: editingPlan.id, ...planData });
        toast({ title: 'Plano atualizado' });
      } else {
        await createPlan.mutateAsync(planData);
        toast({ title: 'Plano criado' });
      }

      setModalOpen(false);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!planToDelete) return;

    try {
      await deletePlan.mutateAsync(planToDelete.id);
      toast({ title: 'Plano excluído' });
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Planos de Assinatura
              </CardTitle>
              <CardDescription>
                Defina os planos e preços para seus estabelecimentos
              </CardDescription>
            </div>
            <Button onClick={handleOpenCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Plano
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!plans?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum plano criado ainda.</p>
              <p className="text-sm">Crie seu primeiro plano para começar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{plan.name}</span>
                      {plan.is_popular && (
                        <Badge variant="default" className="bg-primary">
                          <Star className="h-3 w-3 mr-1" />
                          Popular
                        </Badge>
                      )}
                      {!plan.is_active && (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                    {plan.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {plan.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
                      <span className="font-semibold text-primary">
                        {formatCurrency(plan.monthly_fee)}/mês
                      </span>
                      {(plan.setup_fee ?? 0) > 0 && (
                        <span className="text-muted-foreground">
                          Setup: {formatCurrency(plan.setup_fee!)}
                        </span>
                      )}
                      {(plan.trial_days ?? 0) > 0 && (
                        <span className="text-muted-foreground">
                          {plan.trial_days} dias grátis
                        </span>
                      )}
                      <span className="text-muted-foreground flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {plan.wa_instances_limit ?? 1} conexão{(plan.wa_instances_limit ?? 1) > 1 ? 'ões' : ''} WhatsApp
                      </span>
                      {plan.features && plan.features.length > 0 && (
                        <span className="text-muted-foreground">
                          {plan.features.length} funcionalidades
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(plan)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setPlanToDelete(plan);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? 'Editar Plano' : 'Novo Plano'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Plano</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Plano Básico"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva o que está incluso no plano"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthly_fee">Mensalidade (R$)</Label>
              <Input
                id="monthly_fee"
                type="number"
                step="0.01"
                min="0"
                value={formData.monthly_fee}
                onChange={(e) => setFormData({ ...formData, monthly_fee: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="setup_fee">Taxa de Setup (R$)</Label>
                <Input
                  id="setup_fee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.setup_fee}
                  onChange={(e) => setFormData({ ...formData, setup_fee: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trial_days">Dias de Teste Grátis</Label>
                <Input
                  id="trial_days"
                  type="number"
                  step="1"
                  min="0"
                  value={formData.trial_days}
                  onChange={(e) => setFormData({ ...formData, trial_days: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa_instances_limit">Conexões WhatsApp</Label>
                <Input
                  id="wa_instances_limit"
                  type="number"
                  step="1"
                  min="1"
                  value={formData.wa_instances_limit}
                  onChange={(e) => setFormData({ ...formData, wa_instances_limit: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai_image_enhancements_per_month">Melhorias de Imagem IA / mês</Label>
                <Input
                  id="ai_image_enhancements_per_month"
                  type="number"
                  step="1"
                  min="0"
                  value={formData.ai_image_enhancements_per_month}
                  onChange={(e) => setFormData({ ...formData, ai_image_enhancements_per_month: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">0 = recurso desabilitado</p>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-2">
              <Label>Funcionalidades (para landing page)</Label>
              <div className="flex gap-2">
                <Input
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  placeholder="Ex: Pedidos ilimitados"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddFeature();
                    }
                  }}
                />
                <Button type="button" onClick={handleAddFeature} size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.features.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.features.map((feature, index) => (
                    <Badge key={index} variant="secondary" className="pr-1">
                      {feature}
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(index)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Módulos liberados */}
            <div className="space-y-3 border rounded-lg p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <Label>Funcionalidades liberadas neste plano</Label>
                  <p className="text-xs text-muted-foreground">
                    Somente os módulos marcados aparecerão no painel dos restaurantes deste plano.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setFormData({ ...formData, enabled_features: [...ALL_PLAN_FEATURE_IDS] })
                    }
                  >
                    Marcar tudo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setFormData({ ...formData, enabled_features: [] })}
                  >
                    Limpar
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {PLAN_FEATURE_GROUPS.map((group) => {
                  const groupIds = group.features.map((f) => f.id);
                  const allOn = groupIds.every((id) => formData.enabled_features.includes(id));
                  return (
                    <div key={group.label} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.label}
                        </p>
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => {
                            const set = new Set(formData.enabled_features);
                            if (allOn) {
                              groupIds.forEach((id) => set.delete(id));
                            } else {
                              groupIds.forEach((id) => set.add(id));
                            }
                            setFormData({ ...formData, enabled_features: Array.from(set) });
                          }}
                        >
                          {allOn ? 'Desmarcar grupo' : 'Marcar grupo'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {group.features.map((feat) => {
                          const checked = formData.enabled_features.includes(feat.id);
                          return (
                            <label
                              key={feat.id}
                              className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/50"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const set = new Set(formData.enabled_features);
                                  if (v) set.add(feat.id);
                                  else set.delete(feat.id);
                                  setFormData({
                                    ...formData,
                                    enabled_features: Array.from(set),
                                  });
                                }}
                              />
                              <span className="text-sm">{feat.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="is_popular">Destacar como "Mais Popular"</Label>
                <p className="text-xs text-muted-foreground">
                  Aparecerá em destaque na landing page
                </p>
              </div>
              <Switch
                id="is_popular"
                checked={formData.is_popular}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, is_popular: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="is_active">Plano ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Planos inativos não aparecem ao criar estabelecimentos
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>

            {/* Convenience fee */}
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">Taxa de conveniência (pagamento online)</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Cobrada do cliente final quando ele paga o pedido do cardápio via PIX ou Cartão pelo sistema. Não afeta pagamentos na entrega.
              </p>

              <div>
                <Label htmlFor="conv_type">Modelo de cobrança</Label>
                <Select
                  value={formData.convenience_fee_type}
                  onValueChange={(v) => setFormData({ ...formData, convenience_fee_type: v as ConvenienceFeeType })}
                >
                  <SelectTrigger id="conv_type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem taxa</SelectItem>
                    <SelectItem value="percent">Percentual do pedido (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo por pedido (R$)</SelectItem>
                    <SelectItem value="percent_plus_fixed">Percentual + valor fixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(formData.convenience_fee_type === 'percent' || formData.convenience_fee_type === 'percent_plus_fixed') && (
                <div>
                  <Label htmlFor="conv_pct">Percentual (%)</Label>
                  <Input
                    id="conv_pct"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.convenience_fee_percent}
                    onChange={(e) => setFormData({ ...formData, convenience_fee_percent: e.target.value })}
                  />
                </div>
              )}

              {(formData.convenience_fee_type === 'fixed' || formData.convenience_fee_type === 'percent_plus_fixed') && (
                <div>
                  <Label htmlFor="conv_fix">Valor fixo (R$)</Label>
                  <Input
                    id="conv_fix"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.convenience_fee_fixed}
                    onChange={(e) => setFormData({ ...formData, convenience_fee_fixed: e.target.value })}
                  />
                </div>
              )}

              {formData.convenience_fee_type !== 'none' && (
                <>
                  <div>
                    <Label htmlFor="conv_label">Rótulo mostrado ao cliente</Label>
                    <Input
                      id="conv_label"
                      value={formData.convenience_fee_label}
                      onChange={(e) => setFormData({ ...formData, convenience_fee_label: e.target.value })}
                      placeholder="Taxa de conveniência"
                    />
                  </div>
                  <div>
                    <Label htmlFor="conv_desc">Descrição (tooltip)</Label>
                    <Textarea
                      id="conv_desc"
                      rows={2}
                      value={formData.convenience_fee_description}
                      onChange={(e) => setFormData({ ...formData, convenience_fee_description: e.target.value })}
                      placeholder="Taxa cobrada pelo processamento do pagamento online."
                    />
                  </div>
                </>
              )}
            </div>


            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createPlan.isPending || updatePlan.isPending}
              >
                {(createPlan.isPending || updatePlan.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingPlan ? 'Salvar' : 'Criar Plano'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o plano "{planToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePlan.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
