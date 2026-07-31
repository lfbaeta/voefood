# Peddi - Oficial

📄 PRD: Tá na Mão (Single Restaurant Delivery App)
1. Visão Geral do Projeto
Desenvolver um Web App de Delivery (PWA) mobile-first para um único restaurante. O objetivo é substituir o atendimento manual no WhatsApp por um cardápio digital onde o cliente monta o pedido e o restaurante recebe tudo organizado em uma tela de cozinha (KDS).

Fluxo Principal:

Cliente: Acessa o link ➝ Escolhe produtos ➝ Finaliza pedido (Pagamento na Entrega ou Pix Manual) ➝ Acompanha status em tempo real.

Cozinha (Admin): Recebe pedido na tela com som ➝ Aceita ➝ Se for Pix, envia cobrança com 1 clique no WhatsApp ➝ Despacha ➝ Finaliza.

2. Design System & UI
Cor Primária: #FF5722 (Laranja Vibrante). Use para botões de ação (CTA), ícones ativos e destaques.

Cor Secundária: #25D366 (Verde WhatsApp). Use apenas para ações relacionadas ao WhatsApp/Pix.

Fundo: Claro/Branco (#FFFFFF para cards, #F8F9FA para fundo de tela).

Estilo: Clean, moderno, cantos arredondados (rounded-xl), sombras suaves.

Inspiração: UI do iFood (fotos grandes, navegação por abas, feedback visual rápido).

3. Tech Stack Sugerida
Frontend: React + Vite + TypeScript.

Estilização: Tailwind CSS + Shadcn/UI.

Backend/Banco: Supabase (PostgreSQL + Realtime).

Ícones: Lucide React.

Gerenciamento de Estado: TanStack Query (React Query).

4. Banco de Dados (Schema Supabase)
Crie estas tabelas no Supabase. O sistema é Single Tenant, então não precisamos de tabela de "Restaurantes", apenas uma tabela de configuração da loja.

SQL

-- Configuração da Loja (Apenas 1 linha)
table: store_config
- id (uuid, PK)
- name (text) -- Nome do Restaurante
- phone_whatsapp (text) -- Para receber contato
- pix_key (text) -- Chave Pix para receber pagamento
- pix_key_type (text) -- ex: CPF, CNPJ, Email
- logo_url (text)
- is_open (boolean) -- Abre/Fecha a loja
- delivery_fee (numeric)
- min_order_value (numeric)

-- Categorias
table: categories
- id (uuid, PK)
- name (text) -- ex: Lanches, Bebidas
- sort_order (int)

-- Produtos
table: products
- id (uuid, PK)
- category_id (fk -> categories.id)
- name (text)
- description (text)
- price (numeric)
- image_url (text)
- is_available (boolean) -- Controle de Estoque

-- Pedidos
table: orders
- id (int8, PK, auto-increment) -- ID curto visual (#1001)
- customer_name (text)
- customer_phone (text)
- address_street (text)
- address_number (text)
- address_neighborhood (text)
- total_amount (numeric)
- status (text) -- 'pending', 'preparing', 'delivery', 'completed', 'cancelled'
- payment_method (text) -- 'money', 'card', 'pix'
- change_for (numeric) -- Troco para quanto? (Null se não for dinheiro)
- created_at (timestamp)

-- Itens do Pedido
table: order_items
- id (uuid, PK)
- order_id (fk -> orders.id)
- product_name (text) -- Salvar nome caso mude depois
- quantity (int)
- unit_price (numeric)
- observation (text) -- ex: "Sem cebola"
5. Funcionalidades e Telas (Escopo)
📱 A. Área do Cliente (Mobile)
1. Cardápio Digital (/)

Header com Logo, Status (Aberto/Fechado) e Nome.

Barra de busca fixa no topo.

Lista de Categorias (Abas deslizantes).

Lista de Produtos com foto à direita e botão "+".

Botão Flutuante de Carrinho: "Ver Pedido - R$ 00,00" (Só aparece se tiver itens).

2. Modal de Produto

Foto grande.

Seletor de Quantidade.

Campo de Observação.

3. Checkout (/checkout)

Resumo dos itens.

Formulário de Entrega: Nome, Telefone (WhatsApp), Rua, Número, Bairro.

Seleção de Pagamento (Cards Grandes):

[💵 Dinheiro]: Abre input "Troco para quanto?".

[💳 Cartão]: Exibe texto "Levamos a maquininha".

[💠 PIX]: Exibe texto "Você receberá a chave Pix após confirmar".

Botão "Enviar Pedido" (Laranja).

4. Status do Pedido (/order/:id)

Live Tracking: Escuta o Supabase Realtime para atualizar status sem refresh.

Stepper Visual: 🕒 Pendente -> 👨‍🍳 Preparando -> 🛵 Saiu para Entrega.

Se o pagamento for PIX, mostrar botão: "Enviar Comprovante no Zap".

🖥️ B. Área do Admin (Desktop/Tablet)
1. KDS - Kitchen Display System (/admin)

Layout: Colunas Kanban (Pendentes | Em Preparo | Entrega | Concluídos).

Alerta Sonoro: Tocar som (/alert.mp3) sempre que cair pedido novo na coluna "Pendentes".

Card do Pedido:

Número #ID e Nome do Cliente.

Lista de Itens.

Etiqueta de Pagamento:

Se for Dinheiro: 🟨 "Troco p/ R$ 50".

Se for Cartão: 🟧 "Levar Máquina".

Se for Pix: 🟦 "PIX".

Botão Especial "Cobrar PIX":

Lógica: Só aparece se pagamento == 'pix'.

Ação: Gera link wa.me com mensagem: "Olá [Nome]! Pedido recebido. Total: R$ [Valor]. Chave Pix: [Chave]. Aguardo comprovante!"

Botão Imprimir: Gera layout simples para impressora térmica.

2. Gestão de Cardápio (/admin/menu)

Adicionar/Editar Produtos.

Switch Rápido: "Disponível" (Ativar/Desativar produto que acabou).

3. Configurações (/admin/settings)

Alterar Chave Pix.

Alterar Taxa de Entrega.

Botão "Abrir/Fechar Loja".

6. Regras de Negócio Importantes
Sem Login para Cliente: O cliente não cria conta. Identificação apenas pelo celular no checkout para reduzir fricção.

Validação de Telefone: Aplicar máscara (99) 99999-9999 no input.

Realtime: A tela do Admin deve atualizar sozinha. Use supabase.channel escutando a tabela orders.

7. Instruções para a IA (Lovable/Cursor)
Inicie o projeto configurando o Supabase Client.

Crie primeiro a tela do Cardápio (Cliente) garantindo que a adição ao carrinho funcione localmente.

Crie a tela de Checkout que insere os dados na tabela orders.

Desenvolva o Admin KDS com a lógica de Realtime e o botão de cobrança WhatsApp.

Use componentes do Shadcn/UI para agilidade e aplique a cor Laranja #FF5722 via Tailwind config.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://peddioficial.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8443eb71-faba-4d07-a722-72cbc7b950a5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
