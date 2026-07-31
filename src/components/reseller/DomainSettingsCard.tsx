import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Globe, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useDemoGuard } from "@/hooks/useDemoGuard";
import {
  isValidRootDomain,
  normalizeRootDomain,
  setConfiguredRootDomain,
  getCurrentRootDomain,
} from "@/lib/getSubdomain";

interface Props {
  resellerId: string;
  rootDomain?: string | null;
  onUpdate?: () => void;
}

/**
 * Permite ao super admin definir o domínio principal do sistema,
 * usado como base para os subdomínios dos restaurantes.
 */
export function DomainSettingsCard({ resellerId, rootDomain, onUpdate }: Props) {
  const { toast } = useToast();
  const { checkDemoMode } = useDemoGuard();
  const [value, setValue] = useState(rootDomain || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(rootDomain || "");
  }, [rootDomain]);

  const normalized = normalizeRootDomain(value);
  const valid = !normalized || isValidRootDomain(normalized);
  const effective = normalized || getCurrentRootDomain();

  const handleSave = async () => {
    if (checkDemoMode()) return;
    if (!valid) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("resellers")
        .update({ root_domain: normalized || null })
        .eq("id", resellerId);
      if (error) throw error;

      setConfiguredRootDomain(normalized || null);
      toast({
        title: "Domínio salvo",
        description: normalized
          ? `Os restaurantes usarão subdomínios de ${normalized}.`
          : "Domínio removido — o sistema voltará a usar o domínio atual do navegador.",
      });
      onUpdate?.();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          Domínio principal do sistema
        </CardTitle>
        <CardDescription>
          Base usada para gerar os subdomínios dos restaurantes. Deixe vazio para usar automaticamente o domínio em que
          o sistema está sendo acessado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="root_domain">Domínio</Label>
          <Input
            id="root_domain"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="meudominio.com.br"
            autoComplete="off"
          />
          {!valid && (
            <p className="text-xs text-destructive">Informe um domínio válido, ex.: meudominio.com.br</p>
          )}
        </div>

        <Alert>
          <AlertDescription className="text-xs">
            Exemplo do resultado: <span className="font-mono">pizzaria.{effective}</span> para o cardápio e{" "}
            <span className="font-mono">pizzaria.{effective}/admin</span> para o painel do restaurante. Lembre-se de
            apontar o wildcard <span className="font-mono">*.{effective}</span> no seu DNS.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || !valid}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar domínio
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
