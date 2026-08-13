# Plano de Correção: PDV - Produtos não aparecem e Fluxo de Venda Rápida

O usuário relatou que os produtos não aparecem no PDV e que, na "Venda Rápida", após confirmar (possivelmente a seleção de produtos), o sistema pergunta para onde enviar (Retirada, Balcão, Delivery). Ele parece sugerir que essa escolha deveria ser mais clara ou ocorrer em um momento diferente do fluxo.

## Diagnóstico

### 1. Produtos não aparecendo no PDV
- **Causa Provável**: O `QuickSaleModal` usa o hook `useProducts`, que depende do `restaurantId` retornado por `useEffectiveRestaurantId`. Se o `restaurantId` não for resolvido (ex: em sessões de Super Admin via SSO que ainda não vincularam o contexto do restaurante), a lista de produtos virá vazia.
- **Outra Possibilidade**: Filtro de `is_available` ou erros de RLS.

### 2. Fluxo de Venda Rápida
- **Fluxo Atual**: `Botão Venda Rápida` -> `Modal Tipo de Pedido (Retirada, Balcão, Delivery)` -> `Modal de Seleção de Produtos` -> `Checkout`.
- **Relato do Usuário**: "depois de confirmar aparece vai ser enviado pra onde". Isso indica que ele pode estar achando o fluxo confuso ou que o estado do tipo de pedido não está visível durante a venda.

## Alterações Propostas

### 1. Correção da Listagem de Produtos (`src/components/pdv/QuickSaleModal.tsx`)
- Adicionar logs de depuração para verificar se `restaurantId` está presente.
- Adicionar um estado de "Alerta/Erro" caso o `restaurantId` seja nulo, informando que o contexto do estabelecimento não foi carregado.
- Garantir que o carregamento dos produtos seja exibido claramente.

### 2. Otimização do Fluxo de Venda Rápida (`src/pages/admin/PDV.tsx` e `src/components/pdv/QuickSaleModal.tsx`)
- Manter o tipo de pedido visível no cabeçalho do `QuickSaleModal` (já existe o método `getTitle`, mas vamos garantir que ele seja proeminente).
- Se o usuário reportou que "depois de confirmar aparece", pode haver uma confusão no `QuickSaleCheckout` onde o `selectedOrderType` é usado apenas como fallback para o nome do atendente/garçom. Vamos tornar a seleção do tipo de pedido mais explícita ou permitir alteração se necessário.

### 3. Melhoria na Experiência do Usuário (UX)
- Adicionar uma mensagem de "Nenhum produto cadastrado" com um botão de atalho para o cadastro de produtos, caso a lista retorne vazia mas o `restaurantId` exista.

## Detalhes Técnicos
- Arquivos:
  - `src/components/pdv/QuickSaleModal.tsx`
  - `src/pages/admin/PDV.tsx`
  - `src/hooks/useEffectiveRestaurantId.tsx` (verificar se precisa de suporte extra para contexto de admin)

