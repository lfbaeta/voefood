// Catálogo de tools que o agente IA pode usar (Fase 2 implementa de fato).
// Mantido aqui para a UI de "ferramentas permitidas".
export const AI_TOOL_CATALOG: Array<{ name: string; label: string; description: string; phase: 2 | 3 | 4 }> = [
  { name: 'consultar_cardapio',         label: 'Consultar cardápio',          description: 'Lista produtos disponíveis com preço.',                                   phase: 2 },
  { name: 'consultar_produto_detalhado',label: 'Detalhar produto',            description: 'Ficha completa de um produto com acréscimos e opções.',                  phase: 2 },
  { name: 'criar_pedido',               label: 'Criar pedido',                description: 'Cria pedido de delivery com itens, endereço e pagamento.',                phase: 2 },
  { name: 'consultar_pedido',           label: 'Consultar pedido',            description: 'Mostra status do último pedido do cliente.',                              phase: 2 },
  { name: 'enviar_foto_produto',        label: 'Enviar foto de produto',      description: 'Envia a imagem de um produto pelo WhatsApp com legenda.',                 phase: 2 },
  { name: 'enviar_link_cardapio',       label: 'Enviar link do cardápio',     description: 'Envia o link público do cardápio digital do restaurante.',                phase: 2 },
  { name: 'enviar_link_produto',        label: 'Enviar link de produto',      description: 'Envia link direto para a página de um produto específico.',               phase: 2 },
  { name: 'sugerir_complementos',       label: 'Sugerir complementos',        description: 'Sugere bebidas/sobremesas que combinam com o pedido (upsell).',           phase: 2 },
  { name: 'consultar_taxa_entrega',     label: 'Consultar taxa de entrega',   description: 'Retorna a taxa de entrega pelo bairro/zona.',                             phase: 2 },
  { name: 'consultar_historico_cliente',label: 'Memória do cliente',          description: 'Último pedido, pedido recorrente, endereço e pagamento usuais.',          phase: 2 },
  { name: 'repetir_pedido',             label: 'Repetir pedido',              description: 'Recria um pedido anterior como novo (reaproveita itens/endereço/pagto).', phase: 2 },
  { name: 'consultar_horario_funcionamento', label: 'Horário de funcionamento', description: 'Retorna os horários de abertura/fechamento por dia da semana.',          phase: 2 },
  { name: 'consultar_cupons_ativos',    label: 'Listar cupons ativos',        description: 'Lista cupons válidos para hoje (código, desconto, mínimo).',              phase: 2 },
  { name: 'aplicar_cupom',              label: 'Validar/aplicar cupom',       description: 'Valida um cupom e retorna o desconto calculado para o pedido.',           phase: 2 },
  { name: 'consultar_base_conhecimento',label: 'Buscar na base de conhecimento', description: 'Busca semântica nos textos/FAQs que o restaurante ensinou ao agente.',  phase: 2 },
  { name: 'atualizar_pedido',           label: 'Atualizar pedido',            description: 'Edita itens de um pedido ainda não confirmado.',                          phase: 3 },
  { name: 'cancelar_pedido',            label: 'Cancelar pedido',             description: 'Cancela pedido respeitando o teto de valor.',                             phase: 3 },
  { name: 'consultar_status_entrega',   label: 'Status de entrega',           description: 'Detalha em qual etapa o pedido está.',                                    phase: 3 },
  { name: 'agendar_followup',           label: 'Agendar follow-up',           description: 'Programa uma mensagem futura para o cliente.',                            phase: 3 },
  { name: 'escalar_humano',             label: 'Escalar para humano',         description: 'Transfere a conversa para um atendente.',                                 phase: 3 },
  { name: 'registrar_endereco_desconhecido', label: 'Registrar endereço fora de zona', description: 'Registra endereço sem zona cadastrada para o restaurante criar depois.', phase: 3 },
];

export const AI_MODEL_OPTIONS: Array<{ value: string; label: string; provider: 'lovable' | 'openai' | 'gemini' }> = [
  // Lovable (padrão)
  { value: 'google/gemini-2.5-flash',         label: 'Gemini 2.5 Flash (rápido, padrão)',      provider: 'lovable' },
  { value: 'google/gemini-2.5-flash-lite',    label: 'Gemini 2.5 Flash Lite (mais barato)',    provider: 'lovable' },
  { value: 'google/gemini-2.5-pro',           label: 'Gemini 2.5 Pro (mais preciso)',          provider: 'lovable' },
  { value: 'google/gemini-3-flash-preview',   label: 'Gemini 3 Flash (preview)',               provider: 'lovable' },
  { value: 'openai/gpt-5-mini',               label: 'GPT-5 Mini',                              provider: 'lovable' },
  { value: 'openai/gpt-5-nano',               label: 'GPT-5 Nano (mais barato)',                provider: 'lovable' },
  { value: 'openai/gpt-5',                    label: 'GPT-5 (mais preciso)',                    provider: 'lovable' },
];

export const DEFAULT_AGENT_PROMPT = `Você é o atendente virtual do {RESTAURANTE} no WhatsApp. Tira pedidos com leveza, é gente boa e resolve rápido.

CONVERSA NATURAL (regras DURAS):
- NUNCA repita a mesma frase, pergunta ou informação dentro da mesma resposta. Cada ideia aparece UMA vez só.
- UMA pergunta por mensagem. Nunca duas.
- Quando quiser quebrar a resposta em mais de uma bolha de WhatsApp, separe os blocos com a linha "---" sozinha. Use no máximo 3 bolhas.
- Use 1 ou 2 emojis contextuais por mensagem (🍕🥤😋✅📍🔥). Nunca enfileire emojis.
- Português BR, informal mas educado. Sem markdown (**, *, #, listas com hífen seco).
- Proibido clichê: "Como posso ajudar?", "Estou à disposição", "Fico no aguardo".

ESTRATÉGIA DE ATENDIMENTO:
- Seja PROATIVO: ofereça 2 opções concretas em vez de perguntar aberto.
- Quando o cliente escolher um prato, ofereça UMA bebida ou sobremesa que combine (upsell natural, sem insistir).
- Se o cliente pedir foto de algum item, use enviar_foto_produto (pode enviar até 3 de uma vez via product_ids).
- Se pedir cardápio completo, link, menu ou "manda tudo aí", use enviar_link_cardapio.
- Para falar de um item específico, prefira enviar_link_produto (abre o produto pronto pra escolher acréscimos).
- Antes de fechar um item que tenha opções obrigatórias (ponto da carne, tamanho, sabor, molho), chame consultar_produto_detalhado e pergunte só o que faltar.
- Confirme TUDO antes de fechar: itens, endereço, forma de pagamento e taxa.

REGRAS DE OURO:
- Nunca invente preço, item ou taxa. Sempre use as ferramentas.
- Para taxa de entrega, use consultar_taxa_entrega com o bairro.
- Se consultar_taxa_entrega não achar a zona, chame registrar_endereco_desconhecido com o endereço cru — assim o restaurante cadastra a região depois.
- Se o cliente perguntar horário ou se estamos abertos, use consultar_horario_funcionamento.
- Se o cliente perguntar de cupom/desconto/promoção, use consultar_cupons_ativos. Antes de fechar com desconto, valide com aplicar_cupom (passe o código e o subtotal).
- Se o cliente perguntar algo específico (política, ingredientes, sem glúten, vegano, estacionamento, troca, política de devolução, dúvidas sobre o restaurante), use consultar_base_conhecimento ANTES de inventar resposta. É lá que o restaurante guarda o que ensinou ao agente.
- Para fechar o pedido, use criar_pedido com todos os campos preenchidos, inclusive selected_addons em cada item quando o cliente escolheu acréscimos.
- No INÍCIO de uma nova conversa (cliente sumiu por horas), você já recebe a MEMÓRIA DO CLIENTE no contexto. Se ele tem "pedido de sempre" ou último pedido, cumprimente pelo nome e ofereça repetir já listando os itens — ex: "Fala Gustavo! Vamos no de sempre? hamburguer 09 + batata chips P + coca lata. Confirma?". Sempre pergunte se quer mudar algo.
- Se o cliente confirmar (sim/manda/pode mandar/é isso aí), use repetir_pedido com o order_id de referência — NÃO re-pergunte endereço nem pagamento, eles vêm do pedido base. Só pergunte se ele quiser trocar.
- Se precisar conferir/atualizar a memória durante a conversa, use consultar_historico_cliente.
- Se o cliente quiser falar com pessoa, reclamar de problema sério ou pedir reembolso, use escalar_humano.`;

export const AGENT_TYPE_OPTIONS: Array<{ value: string; label: string; emoji: string; description: string }> = [
  { value: 'attendant', label: 'Atendente',       emoji: '💬', description: 'Tira pedidos e tira dúvidas no WhatsApp.' },
  { value: 'seller',    label: 'Vendedor',        emoji: '🔥', description: 'Foco em upsell, combos e fechar pedido rápido.' },
  { value: 'support',   label: 'Suporte',         emoji: '🛟', description: 'Resolve reclamações, status de pedido, pós-venda.' },
  { value: 'waiter',    label: 'Garçom Digital',  emoji: '🍽️', description: 'Atende mesas via QR Code e chama o garçom humano.' },
  { value: 'custom',    label: 'Personalizado',   emoji: '✨', description: 'Você define do zero.' },
];

export const TONE_OPTIONS = [
  { value: 'friendly',     label: 'Amigável (padrão)' },
  { value: 'fun',          label: 'Divertido / Descontraído' },
  { value: 'formal',       label: 'Formal' },
  { value: 'professional', label: 'Profissional' },
] as const;

export const MESSAGE_LENGTH_OPTIONS = [
  { value: 'short',  label: 'Curtas (recomendado WhatsApp)' },
  { value: 'medium', label: 'Médias' },
  { value: 'long',   label: 'Longas (explicativas)' },
] as const;

export const EMOJI_LEVEL_OPTIONS = [
  { value: 'none',     label: 'Sem emojis' },
  { value: 'moderate', label: 'Moderado (1–2 por msg)' },
  { value: 'heavy',    label: 'Animado (vários, com bom gosto)' },
] as const;

export const CAN_DO_PRESETS = [
  'Oferecer bebida que combine com o pedido',
  'Sugerir sobremesa após o prato principal',
  'Enviar foto do produto quando o cliente pedir',
  'Compartilhar link do cardápio digital',
  'Calcular taxa de entrega pelo bairro',
  'Confirmar resumo do pedido antes de fechar',
  'Pedir feedback após a entrega',
];

export const CANNOT_DO_PRESETS = [
  'Inventar preço ou produto que não está no cardápio',
  'Prometer prazo de entrega menor que o padrão',
  'Dar desconto sem cupom válido',
  'Falar de assuntos fora do restaurante (política, religião)',
  'Fechar pedido sem confirmar endereço completo',
];

export const FORBIDDEN_PHRASES_PRESETS = [
  'Como posso ajudar?',
  'Estou à disposição',
  'Fico no aguardo',
  'Conforme solicitado',
];