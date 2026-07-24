import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Check, ExternalLink, Globe } from "lucide-react";
import { getCurrentRootDomain, buildRestaurantUrl, shouldUsePathBasedRouting } from "@/lib/getSubdomain";
import { useToast } from "@/hooks/use-toast";

interface Props {
  slug: string;
  compact?: boolean;
}

/**
 * Bloco com passo-a-passo para conectar o subdomínio do restaurante
 * (DNS na Cloudflare + cadastro em Project Settings → Domains do Lovable).
 */
export function SubdomainSetupCard({ slug, compact = false }: Props) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const root = getCurrentRootDomain();
  const fullHost = `${slug}.${root}`;
  const url = buildRestaurantUrl(slug);
  const isPreview = shouldUsePathBasedRouting();

  const copy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
    toast({ title: "Copiado!", description: value });
  };

  const CopyRow = ({ label, value, k }: { label: string; value: string; k: string }) => (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-xs">{value}</p>
      </div>
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copy(value, k)}>
        {copied === k ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );

  return (
    <Card className={compact ? "border-primary/40" : ""}>
      <CardHeader className={compact ? "pb-3" : ""}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4 text-primary" />
          Conectar subdomínio deste restaurante
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPreview && (
          <Alert>
            <AlertDescription className="text-xs">
              Você está no preview. Em produção o restaurante ficará em <span className="font-mono">{fullHost}</span>.
            </AlertDescription>
          </Alert>
        )}

        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">URL final do restaurante</p>
          <CopyRow label="URL pública" value={url} k="url" />
        </div>

        <Alert className="bg-primary/5 border-primary/20">
          <AlertDescription className="text-xs">
            O wildcard <span className="font-mono">*.{root}</span> já está configurado no Cloudflare, então não é
            necessário criar registro individual para cada restaurante.
          </AlertDescription>
        </Alert>

        <ol className="space-y-3 text-sm">
          <li>
            <p className="font-medium">1. Cadastre o subdomínio no Lovable</p>
            <p className="text-xs text-muted-foreground">
              Abra <span className="font-medium">Project Settings → Domains → Connect Domain</span> e cole:
            </p>
            <div className="mt-2">
              <CopyRow label="Domínio" value={fullHost} k="host" />
            </div>
          </li>

          <li>
            <p className="font-medium">2. Adicione o TXT de verificação no Cloudflare</p>
            <p className="text-xs text-muted-foreground">
              O Lovable vai mostrar um registro <span className="font-mono">TXT</span> com nome{" "}
              <span className="font-mono">_lovable.{slug}</span> e um valor único. Copie do painel do Lovable e cole no
              Cloudflare exatamente como aparece.
            </p>
          </li>

          <li>
            <p className="font-medium">3. Aguarde a emissão do SSL</p>
            <p className="text-xs text-muted-foreground">
              Em poucos minutos o Lovable emite o certificado e o subdomínio fica <span className="font-medium">Ativo</span>.
              A partir daí <span className="font-mono">{fullHost}</span> abre o cardápio e{" "}
              <span className="font-mono">{fullHost}/admin</span> o painel do dono.
            </p>
          </li>
        </ol>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("https://dash.cloudflare.com", "_blank")}
          >
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            Abrir Cloudflare
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(url, "_blank")}>
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            Testar URL
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
