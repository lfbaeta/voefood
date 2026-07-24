
# Revisão completa da impressão

## Diagnóstico atual (o que existe hoje)

- `usePrintSettings` guarda **tudo em localStorage** por navegador → cada aparelho precisa ser reconfigurado; o dono não vê/gerencia central.
- `autoPrintOrder` só é chamado a partir de:
  - `useOrdersRealtime` (delivery, funciona)
  - `AddItemModal` e `QuickSaleCheckout` (PDV, no aparelho que gerou)
- Ou seja: se o pedido de **mesa/balcão** é criado em um tablet e a impressora está no caixa, **nada imprime**.
- `printerWidth` do settings **não é propagado** ao `printReceipt` (sempre usa 48 col).
- Não há **fila / retentativa**: se a Web Serial falhar ou o navegador estiver fechado, o pedido nunca imprime.
- Cozinha e Bar são separados por item, mas usam a **mesma porta serial** — impossível ter 2 impressoras físicas.
- Sem **log de impressões**, sem reimpressão a partir do painel de configuração, sem status "impressora online".
- Reimpressão manual (`PrintReceiptButton`) existe só em mesa/histórico PDV e detalhe de pedido; não tem em Kanban de Pedidos nem em KDS.

## Objetivo

Reescrever o módulo em torno de 3 pilares:

1. **Configuração central por restaurante** (persistida no banco).
2. **Estação de impressão** — 1 aparelho eleito imprime tudo, os demais só disparam o job.
3. **Fila auditável** com retentativa, log e reimpressão.

## Escopo por fase

### Fase 1 — Modelo de dados

Novas tabelas (RLS por `restaurant_id`, GRANTs padrão):

```text
print_stations
  id, restaurant_id, name, device_fingerprint,
  role ('all'|'kitchen'|'bar'|'cashier'),
  paper_width (48|32), copies, last_seen_at, is_active

print_jobs
  id, restaurant_id, station_role,
  source ('delivery'|'table'|'quick_sale'|'reprint'|'test'),
  source_id (uuid/text), payload jsonb,
  status ('pending'|'printing'|'done'|'failed'|'cancelled'),
  attempts, last_error, printed_at, printed_by_station,
  created_at, updated_at
```

Colunas novas em `store_config`:
`auto_print_enabled`, `auto_print_delivery`, `auto_print_table`, `auto_print_quick_sale`,
`print_split_by_department` (bool), `print_default_paper_width`, `print_default_copies`.

Migration inclui GRANT SELECT/INSERT/UPDATE ao `authenticated` + `service_role`, RLS por `is_admin_of_restaurant(restaurant_id)`.

### Fase 2 — Enfileiramento (substitui `autoPrintOrder` direto)

- Novo `src/lib/printQueue.ts`: `enqueuePrintJob({ restaurantId, source, sourceId, payload, stationRole })` grava em `print_jobs` (dedupe por `source+source_id+station_role`).
- Substituir todas as chamadas atuais de `autoPrintOrder(...)` (em `useOrdersRealtime`, `AddItemModal`, `QuickSaleCheckout`) por `enqueuePrintJob(...)`.
- Um **trigger no banco** também enfileira automaticamente quando `orders`, `table_orders` ou vendas balcão são inseridos — assim funciona mesmo se nenhum navegador estiver na tela do PDV.

### Fase 3 — Estação de impressão

- Novo hook `usePrintStation()` + tela **Configurações → Impressão**:
  - Botão "Tornar este aparelho a estação de impressão" (grava device fingerprint no `print_stations`).
  - Escolher papel de trabalho: Cozinha, Bar, Caixa, ou "tudo".
  - Suportar **até 3 portas Web Serial** memorizadas no aparelho (uma por papel).
- Novo componente `PrintStationRunner` (montado no `AdminLayout` quando este aparelho é estação):
  - Assina realtime em `print_jobs` filtrando pelo papel da estação.
  - Ao receber `pending`: marca `printing`, envia ESC/POS via porta configurada (ou browser fallback), marca `done`. Erros → `failed` com `last_error` e retry exponencial (até 3x).
  - Pinga `last_seen_at` a cada 30s → indicador "Estação online".

### Fase 4 — Roteamento por departamento com impressoras separadas

- `enqueuePrintJob` chama `splitItemsByDepartment` e cria **1 job por departamento com itens**.
- Cada job carrega `station_role` = `kitchen` | `bar`.
- Se apenas uma estação existe com `role='all'`, ela pega os dois jobs; se há estação por papel, cada uma pega o seu.
- Ticket do **caixa** (recibo completo com totais/pagamento) é um job separado com `station_role='cashier'`.

### Fase 5 — UI de gerenciamento

Reformar `PrintSettings.tsx` em abas:

1. **Automação** — chaves gerais (agora salvas em `store_config`, não localStorage).
2. **Este aparelho** — status da estação, portas conectadas, teste por papel.
3. **Impressoras** — lista de estações registradas (nome, papel, última atividade, botão remover).
4. **Fila** — últimos 50 jobs com status, erro, botão "Reimprimir".

Adicionar `PrintReceiptButton` também no card do Kanban de Pedidos e no KDS (Cozinha/Bar) — dispara `enqueuePrintJob(source='reprint')`.

### Fase 6 — Contingência e observabilidade

- Se nenhuma estação com papel compatível está online há > 2 min, mostrar banner no painel admin: *"Impressora offline — X pedidos aguardando."*
- Aviso sonoro configurável ao enfileirar novo job em cozinha/bar.
- Reprocessar jobs `failed` manualmente ou automaticamente ao reconectar.

## Detalhes técnicos

- Web Serial permanece client-side; o banco só orquestra. Nada de driver server-side.
- `printerWidth` finalmente é respeitado: `printReceipt(payload, { width })` e `printReceiptBrowser` recebem largura vinda do `print_stations`.
- Dedupe por chave composta impede impressão dupla mesmo com múltiplos runners abertos (transação `UPDATE ... WHERE status='pending' RETURNING`).
- Fingerprint = hash simples de `userAgent + screen + random armazenado no localStorage` (não é PII).
- Sem novos secrets, sem dependência externa; tudo em Lovable Cloud.

## Diagrama do fluxo

```text
Novo pedido (delivery/mesa/balcão)
        │
        ▼
enqueuePrintJob  ──►  print_jobs (pending, por departamento)
        │
        ▼   (Realtime)
PrintStationRunner do aparelho eleito
        │
   ┌────┴────┐
   ▼         ▼
Web Serial  Browser print (fallback)
   │
   ▼
UPDATE status='done' + log
```

## Fora do escopo (fica para depois)

- Impressora de rede TCP/IP direta (exige bridge local).
- Impressora Bluetooth em Android (exige app nativo).
- Envio de comanda por e-mail/PDF.
