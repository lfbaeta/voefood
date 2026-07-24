import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, Receipt, HandCoins,
  Lock, Unlock, Loader2, Plus, TrendingUp, TrendingDown, History,
} from 'lucide-react';
import {
  useOpenCashSession,
  useCashSessionMovements,
  useCashSessionSummary,
  useRecentCashSessions,
  useOpenCash,
  useAddCashMovement,
  useCloseCash,
  type CashMovementType,
} from '@/hooks/useCashRegister';

const MOVEMENT_LABELS: Record<CashMovementType, { label: string; icon: any; tone: string }> = {
  reforco: { label: 'Reforço', icon: ArrowUpCircle, tone: 'text-success' },
  sangria: { label: 'Sangria', icon: ArrowDownCircle, tone: 'text-warning' },
  despesa: { label: 'Despesa', icon: Receipt, tone: 'text-destructive' },
  recebimento: { label: 'Recebimento', icon: HandCoins, tone: 'text-info' },
};

const PAYMENT_LABELS: Record<string, string> = {
  money: 'Dinheiro',
  dinheiro: 'Dinheiro',
  cash: 'Dinheiro',
  pix: 'PIX',
  card: 'Cartão',
  credit: 'Cartão de crédito',
  debit: 'Cartão de débito',
  outros: 'Outros',
};

const money = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function formatMethod(m: string) {
  return PAYMENT_LABELS[m] || m.charAt(0).toUpperCase() + m.slice(1);
}

export default function CashRegister() {
  const { data: session, isLoading } = useOpenCashSession();
  const { data: recent = [] } = useRecentCashSessions();
  const openCashMut = useOpenCash();
  const [openDialog, setOpenDialog] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingNotes, setOpeningNotes] = useState('');

  const handleOpen = async () => {
    const value = parseFloat(openingAmount.replace(',', '.'));
    if (isNaN(value) || value < 0) return;
    await openCashMut.mutateAsync({ opening_amount: value, opening_notes: openingNotes });
    setOpenDialog(false);
    setOpeningAmount('');
    setOpeningNotes('');
  };

  return (
    <AdminLayout title="Caixa">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Wallet className="w-6 h-6 text-primary" />
              Gestão de Caixa
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Abra o caixa no início do turno e feche com conferência ao final.
            </p>
          </div>
          {session ? (
            <Badge className="bg-success text-success-foreground gap-1.5 px-3 py-1.5">
              <Unlock className="w-3.5 h-3.5" /> Caixa aberto
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
              <Lock className="w-3.5 h-3.5" /> Caixa fechado
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !session ? (
          <Card>
            <CardHeader>
              <CardTitle>Nenhum caixa aberto</CardTitle>
              <CardDescription>
                Abra um caixa para começar a registrar movimentações e vincular as vendas do turno.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setOpenDialog(true)} size="lg" className="gap-2">
                <Plus className="w-4 h-4" />
                Abrir caixa
              </Button>
            </CardContent>
          </Card>
        ) : (
          <OpenSessionPanel sessionId={session.id} openingAmount={session.opening_amount} openedAt={session.opened_at} openingNotes={session.opening_notes} />
        )}

        <RecentSessionsCard sessions={recent} />
      </div>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir caixa</DialogTitle>
            <DialogDescription>
              Informe o valor em dinheiro que está no caixa no início do turno (troco).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="opening_amount">Valor de abertura (R$)</Label>
              <Input
                id="opening_amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="opening_notes">Observações (opcional)</Label>
              <Textarea
                id="opening_notes"
                placeholder="Ex: turno da tarde, operador João"
                value={openingNotes}
                onChange={(e) => setOpeningNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button onClick={handleOpen} disabled={openCashMut.isPending}>
              {openCashMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Abrir caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

/* ------------- open session panel ------------- */

function OpenSessionPanel({
  sessionId, openingAmount, openedAt, openingNotes,
}: { sessionId: string; openingAmount: number; openedAt: string; openingNotes: string | null }) {
  const { data: summary } = useCashSessionSummary(sessionId);
  const { data: movements = [] } = useCashSessionMovements(sessionId);
  const addMov = useAddCashMovement();

  const [movType, setMovType] = useState<CashMovementType>('sangria');
  const [movAmount, setMovAmount] = useState('');
  const [movDesc, setMovDesc] = useState('');
  const [closeOpen, setCloseOpen] = useState(false);

  const handleAdd = async () => {
    const value = parseFloat(movAmount.replace(',', '.'));
    if (isNaN(value) || value <= 0) return;
    await addMov.mutateAsync({
      session_id: sessionId,
      type: movType,
      amount: value,
      description: movDesc,
    });
    setMovAmount('');
    setMovDesc('');
  };

  const salesTotal = summary?.sales_total ?? 0;
  const dinheiroSales = (summary?.sales_by_method?.money ?? 0)
    + (summary?.sales_by_method?.dinheiro ?? 0)
    + (summary?.sales_by_method?.cash ?? 0);

  const expectedCash =
    openingAmount
    + dinheiroSales
    + (summary?.reforco_total ?? 0)
    + (summary?.recebimento_total ?? 0)
    - (summary?.sangria_total ?? 0)
    - (summary?.despesa_total ?? 0);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Abertura" value={money(openingAmount)} icon={Unlock} tone="text-primary" />
        <StatCard label="Vendas do turno" value={money(salesTotal)} icon={TrendingUp} tone="text-success" />
        <StatCard
          label="Movimentações líquidas"
          value={money(
            (summary?.reforco_total ?? 0) + (summary?.recebimento_total ?? 0)
            - (summary?.sangria_total ?? 0) - (summary?.despesa_total ?? 0)
          )}
          icon={TrendingDown}
          tone="text-info"
        />
        <StatCard label="Dinheiro esperado" value={money(expectedCash)} icon={Wallet} tone="text-warning" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova movimentação</CardTitle>
          <CardDescription>Sangria, reforço, despesa avulsa ou recebimento sem venda.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[160px_140px_1fr_auto]">
            <Select value={movType} onValueChange={(v) => setMovType(v as CashMovementType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(MOVEMENT_LABELS) as CashMovementType[]).map((k) => (
                  <SelectItem key={k} value={k}>{MOVEMENT_LABELS[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Valor (R$)"
              value={movAmount}
              onChange={(e) => setMovAmount(e.target.value)}
            />
            <Input
              placeholder="Descrição (opcional)"
              value={movDesc}
              onChange={(e) => setMovDesc(e.target.value)}
            />
            <Button onClick={handleAdd} disabled={addMov.isPending || !movAmount}>
              {addMov.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar'}
            </Button>
          </div>

          <Separator className="my-4" />

          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma movimentação registrada neste caixa ainda.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {movements.map((m) => {
                const cfg = MOVEMENT_LABELS[m.type];
                const Icon = cfg.icon;
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/40">
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`w-5 h-5 shrink-0 ${cfg.tone}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{cfg.label}</p>
                        {m.description && (
                          <p className="text-xs text-muted-foreground truncate">{m.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{money(m.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(m.created_at), 'HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Vendas por forma de pagamento</CardTitle>
            <CardDescription>
              Aberto em {format(new Date(openedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              {openingNotes ? ` — ${openingNotes}` : ''}
            </CardDescription>
          </div>
          <Button variant="destructive" onClick={() => setCloseOpen(true)} className="gap-2">
            <Lock className="w-4 h-4" /> Fechar caixa
          </Button>
        </CardHeader>
        <CardContent>
          {!summary || Object.keys(summary.sales_by_method).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma venda registrada no período.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(summary.sales_by_method).map(([method, total]) => (
                <div key={method} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <span className="text-sm text-foreground">{formatMethod(method)}</span>
                  <span className="font-semibold text-foreground">{money(Number(total))}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CloseCashDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        sessionId={sessionId}
        expectedCash={expectedCash}
        salesByMethod={summary?.sales_by_method ?? {}}
      />
    </>
  );
}

/* ------------- close dialog ------------- */

function CloseCashDialog({
  open, onOpenChange, sessionId, expectedCash, salesByMethod,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessionId: string;
  expectedCash: number;
  salesByMethod: Record<string, number>;
}) {
  const closeMut = useCloseCash();
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');

  // Métodos considerados: dinheiro + todos os métodos que tiveram venda
  const methods = Array.from(new Set(['money', ...Object.keys(salesByMethod)]));

  const expectedByMethod: Record<string, number> = {};
  methods.forEach((m) => {
    if (m === 'money' || m === 'dinheiro' || m === 'cash') {
      expectedByMethod[m] = expectedCash;
    } else {
      expectedByMethod[m] = salesByMethod[m] ?? 0;
    }
  });

  // Deduplica dinheiro (money vs dinheiro vs cash)
  const uniqueMethods = methods.filter((m, i, arr) => {
    const isMoney = ['money', 'dinheiro', 'cash'].includes(m);
    if (!isMoney) return true;
    return arr.findIndex((x) => ['money', 'dinheiro', 'cash'].includes(x)) === i;
  });

  const countedTotal = uniqueMethods.reduce((sum, m) => {
    const v = parseFloat((counted[m] || '').replace(',', '.'));
    return sum + (isNaN(v) ? 0 : v);
  }, 0);
  const expectedTotal = uniqueMethods.reduce((sum, m) => sum + (expectedByMethod[m] ?? 0), 0);
  const difference = countedTotal - expectedTotal;

  const handleClose = async () => {
    const countedMap: Record<string, number> = {};
    uniqueMethods.forEach((m) => {
      const v = parseFloat((counted[m] || '').replace(',', '.'));
      countedMap[m] = isNaN(v) ? 0 : v;
    });
    await closeMut.mutateAsync({
      session_id: sessionId,
      counted_amounts: countedMap,
      expected_amounts: expectedByMethod,
      difference,
      closing_notes: notes,
    });
    onOpenChange(false);
    setCounted({});
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Fechar caixa (Z-report)</DialogTitle>
          <DialogDescription>
            Informe o valor contado de cada forma de pagamento para conferência.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto">
          {uniqueMethods.map((m) => {
            const expected = expectedByMethod[m] ?? 0;
            return (
              <div key={m} className="grid grid-cols-[1fr_140px_140px] gap-2 items-center">
                <Label className="text-sm">{formatMethod(m)}</Label>
                <div className="text-xs text-right text-muted-foreground">
                  Esperado<br /><span className="text-foreground font-medium">{money(expected)}</span>
                </div>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="Contado"
                  value={counted[m] || ''}
                  onChange={(e) => setCounted({ ...counted, [m]: e.target.value })}
                />
              </div>
            );
          })}

          <Separator />

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total esperado</span>
              <span className="font-medium text-foreground">{money(expectedTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total contado</span>
              <span className="font-medium text-foreground">{money(countedTotal)}</span>
            </div>
            <div className="flex justify-between text-base pt-1 border-t border-border">
              <span className="font-semibold">Diferença</span>
              <span className={`font-bold ${
                Math.abs(difference) < 0.005 ? 'text-success'
                  : difference > 0 ? 'text-info'
                  : 'text-destructive'
              }`}>
                {money(difference)}
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Label htmlFor="closing_notes">Observações</Label>
            <Textarea
              id="closing_notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: sobra por gorjeta, falta de troco..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleClose} disabled={closeMut.isPending}>
            {closeMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar fechamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------- recent sessions ------------- */

function RecentSessionsCard({ sessions }: { sessions: any[] }) {
  if (sessions.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-4 h-4" /> Histórico recente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {format(new Date(s.opened_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {s.closed_at && ` → ${format(new Date(s.closed_at), 'HH:mm', { locale: ptBR })}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Abertura {money(s.opening_amount)}
                  {s.difference != null && ` • Diferença ${money(s.difference)}`}
                </p>
              </div>
              <Badge variant={s.status === 'open' ? 'default' : 'secondary'}>
                {s.status === 'open' ? 'Aberto' : 'Fechado'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------- utility ------------- */

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
          <Icon className={`w-5 h-5 ${tone}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
