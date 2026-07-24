import { AlertCircle } from 'lucide-react';

/**
 * Página exibida quando alguém acessa /admin no domínio raiz (sem subdomínio).
 * Explica que o painel administrativo é acessado via `<slug>.peddi.online/admin`.
 */
export default function AdminOnRoot() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <AlertCircle className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">Painel administrativo</h1>
          <p className="text-sm text-muted-foreground">
            O painel de cada estabelecimento é acessado pelo endereço próprio da loja,
            por exemplo:
          </p>
          <p className="text-sm font-mono text-foreground bg-muted rounded-md px-3 py-2 break-all">
            https://<span className="text-primary">seurestaurante</span>.peddi.online/admin
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Se você é um revendedor, acesse o painel em{' '}
          <a href="/reseller" className="text-primary hover:underline font-medium">
            /reseller
          </a>
          .
        </p>
      </div>
    </div>
  );
}
