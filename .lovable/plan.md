# Plano de Correção: PDV - Produtos não aparecem e Fluxo de Venda Rápida

O usuário relatou dois problemas no PDV:
1. Os produtos cadastrados não estão aparecendo na tela de seleção.
2. O fluxo de "Venda Rápida" está invertido ou confuso: a seleção do tipo de pedido (Retirada, Balcão, Delivery) aparece *após* a confirmação (ou o usuário deseja que ela seja a primeira etapa, o que já parece ser o caso no código, mas pode haver um bug visual ou de estado).

## Diagnóstico
- **Produtos não aparecendo**: O `QuickSaleModal` utiliza o hook `useProducts`, que depende de `restaurantId`. Se o `restaurantId` não estiver sendo resolvido corretamente no contexto do PDV (especialmente se o usuário for um Super Admin ou Revendedor acessando via SSO), os produtos não serão listados.
- **Fluxo de Venda Rápida**: No código atual (`src/pages/admin/PDV.tsx`), ao clicar em "Venda Rápida", abre-se o `QuickSaleOrderTypeModal`. Após a seleção, abre-se o `QuickSaleModal`. O relato do usuário sugere que ele espera que essa escolha seja clara e que os produtos apareçam logo em seguida.

## Alterações Propostas

### 1. Frontend: Verificação do `restaurantId` no PDV
- Validar se o `restaurantId` está presente antes de abrir os modais de venda.
- Adicionar logs de depuração temporários ou estados de carregamento mais claros se os produtos demorarem a carregar.
- Garantir que `useEffectiveRestaurantId` (usado por `useProducts`) esteja capturando corretamente o ID em sessões administrativas.

### 2. Frontend: Melhoria no `QuickSaleModal.tsx`
- Verificar a lógica de filtragem `is_available`. Se os produtos estiverem cadastrados mas marcados como indisponíveis, eles não aparecem.
- Adicionar um estado visual para quando a lista de produtos estiver vazia, incentivando o cadastro ou verificando a conexão.

### 3. Ajuste no Fluxo de Venda Rápida
- No `PDV.tsx`, garantir que a transição entre `QuickSaleOrderTypeModal` e `QuickSaleModal` seja fluida.
- Verificar se o `selectedOrderType` está sendo passado e utilizado corretamente para filtrar ou exibir informações.

## Detalhes Técnicos
- Arquivos afetados:
    - `src/pages/admin/PDV.tsx`: Gerenciamento de estado dos modais.
    - `src/components/pdv/QuickSaleModal.tsx`: Renderização da lista de produtos e filtros.
- Verificação de RLS: Confirmar se a política de `SELECT` na tabela `products` permite que o usuário atual (Admin/Reseller) veja os itens. (Já verificado em migrações anteriores, mas vale confirmar no contexto do hook).
