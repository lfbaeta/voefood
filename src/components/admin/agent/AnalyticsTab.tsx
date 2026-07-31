import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Stats = {
  conversations: number;
  ordersCreated: number;
  toolCalls: number;
  toolErrors: number;
  avgResponseSec: number | null;
  topTools: Array<{ name: string; count: number; errors: number }>;
  conversionPct: number;
};

export function AnalyticsTab({ restaurantId, agentId }: { restaurantId: string; agentId: string | null }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    if (!restaurantId) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, agentId, days]);

  async function load() {
    setLoading(true);
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const baseTool = supabase.from('agent_tool_executions')
        .select('tool_name, success, duration_ms', { count: 'exact' })
        .eq('restaurant_id', restaurantId)
        .gte('created_at', since);
      const toolQ = agentId ? baseTool.eq('agent_id', agentId) : baseTool;
      const baseOrders = supabase.from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .gte('created_at', since)
        .not('created_by_agent_id', 'is', null);
      const ordersQ = agentId ? baseOrders.eq('created_by_agent_id', agentId) : baseOrders;
      const convsQ = supabase.from('wa_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .gte('last_message_at', since);

      const [{ data: tools }, { count: ordersCount }, { count: convsCount }] = await Promise.all([toolQ, ordersQ, convsQ]);

      const toolCalls = tools?.length ?? 0;
      const toolErrors = (tools ?? []).filter((t: any) => !t.success).length;
      const durations = (tools ?? []).map((t: any) => Number(t.duration_ms || 0)).filter((n) => n > 0);
      const avgResponseSec = durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) / 100) / 10 : null;
      const byTool = new Map<string, { count: number; errors: number }>();
      for (const t of tools ?? []) {
        const cur = byTool.get(t.tool_name) || { count: 0, errors: 0 };
        cur.count++;
        if (!t.success) cur.errors++;
        byTool.set(t.tool_name, cur);
      }
      const topTools = Array.from(byTool.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      const conversions = convsCount ? Math.round(((ordersCount ?? 0) / convsCount) * 100) : 0;

      setStats({
        conversations: convsCount ?? 0,
        ordersCreated: ordersCount ?? 0,
        toolCalls,
        toolErrors,
        avgResponseSec,
        topTools,
        conversionPct: conversions,
      });
    } finally { setLoading(false); }
  }

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin" /> Calculando…</div>;
  if (!stats) return null;

  return (
    <div className="space-y-4 pt-2">
      <div className="flex gap-2 text-xs">
        {[1, 7, 30].map((d) => (
          <button key={d} onClick={() => setDays(d)} className={`px-3 py-1 rounded-full border ${days === d ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>{d === 1 ? 'Hoje' : `${d}d`}</button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Conversas" value={stats.conversations} />
        <Stat label="Pedidos do agente" value={stats.ordersCreated} />
        <Stat label="Conversão" value={`${stats.conversionPct}%`} />
        <Stat label="Tempo médio (s)" value={stats.avgResponseSec ?? '—'} />
        <Stat label="Chamadas de tools" value={stats.toolCalls} />
        <Stat label="Erros em tools" value={stats.toolErrors} tone={stats.toolErrors > 0 ? 'warn' : 'ok'} />
      </div>
      <Card className="p-4 space-y-2">
        <div className="text-sm font-semibold">Tools mais usadas</div>
        {stats.topTools.length === 0 && <p className="text-xs text-muted-foreground">Sem chamadas no período.</p>}
        {stats.topTools.map((t) => (
          <div key={t.name} className="flex items-center justify-between text-sm border-b last:border-b-0 py-1">
            <span className="font-mono text-xs">{t.name}</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{t.count}</Badge>
              {t.errors > 0 && <Badge variant="destructive">{t.errors} erros</Badge>}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: any; tone?: 'ok' | 'warn' }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${tone === 'warn' ? 'text-destructive' : ''}`}>{value}</div>
    </Card>
  );
}