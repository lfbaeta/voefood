// Common SEFAZ / NFC-e rejection code translator (PT-BR)
// Focus NFe returns messages usually starting with "Rejeição: <code> - <msg>"
// or with codes in `codigo_sefaz`. This helper turns technical messages into
// operator-friendly hints.

const COMMON: Record<string, { title: string; hint: string }> = {
  '204': { title: 'Duplicidade de NFC-e', hint: 'Já existe uma nota autorizada com essa numeração. Ajuste o "Próximo número" nas configurações fiscais.' },
  '215': { title: 'Falha no schema XML', hint: 'Algum campo obrigatório está vazio ou inválido. Reveja endereço fiscal, CNPJ e CSC.' },
  '217': { title: 'NFC-e não consta na base', hint: 'A SEFAZ ainda não processou. Tente "Verificar" em alguns segundos.' },
  '218': { title: 'NFC-e já cancelada', hint: 'Esta nota já foi cancelada anteriormente.' },
  '220': { title: 'Prazo de cancelamento expirado', hint: 'NFC-e só pode ser cancelada em até 30 minutos após a autorização.' },
  '226': { title: 'UF do emitente diverge', hint: 'A UF cadastrada não bate com a IE. Confira endereço fiscal e IE.' },
  '233': { title: 'CSC inválido', hint: 'O CSC Token ou CSC ID está incorreto. Refaça o cadastro nas configurações fiscais.' },
  '236': { title: 'Chave duplicada', hint: 'Já existe NFC-e com esta chave. Aumente o "Próximo número".' },
  '238': { title: 'CPF do destinatário inválido', hint: 'Verifique o CPF informado na nota.' },
  '277': { title: 'CFOP não permitido para NFC-e', hint: 'Ajuste o CFOP padrão para 5102 (venda de mercadoria).' },
  '291': { title: 'CSOSN incompatível com Simples Nacional', hint: 'Use CSOSN 102 (Sem permissão de crédito) para restaurantes no Simples.' },
  '297': { title: 'CSC não cadastrado na SEFAZ', hint: 'Solicite o CSC no portal da SEFAZ do seu estado e cadastre nas configurações.' },
  '539': { title: 'Duplicidade de NFC-e com chave diferente', hint: 'Aguarde alguns segundos e tente reemitir; se persistir, incremente o "Próximo número".' },
  '778': { title: 'IE do emitente inválida', hint: 'Confira a Inscrição Estadual cadastrada.' },
  '999': { title: 'Erro não catalogado', hint: 'Registre o print da mensagem original para o suporte.' },
};

export function translateSefaz(raw?: string | null): { title: string; hint?: string; raw: string } {
  const text = (raw ?? '').trim();
  if (!text) return { title: 'Sem detalhes', raw: '' };

  // Try to extract 3-digit rejection code
  const m = text.match(/\b(\d{3})\b/);
  if (m && COMMON[m[1]]) {
    const c = COMMON[m[1]];
    return { title: `Rejeição ${m[1]} - ${c.title}`, hint: c.hint, raw: text };
  }

  const lower = text.toLowerCase();
  if (lower.includes('csc')) return { title: 'CSC inválido', hint: COMMON['233'].hint, raw: text };
  if (lower.includes('duplicidade')) return { title: 'NFC-e duplicada', hint: COMMON['204'].hint, raw: text };
  if (lower.includes('cnpj')) return { title: 'Problema no CNPJ emitente', hint: 'Confira CNPJ, IE e cadastro na Focus NFe.', raw: text };
  if (lower.includes('certificado')) return { title: 'Problema no certificado digital', hint: 'Verifique o certificado A1 cadastrado no provedor.', raw: text };
  if (lower.includes('offline') || lower.includes('indispon')) return { title: 'SEFAZ indisponível', hint: 'Aguarde alguns minutos e tente novamente. A Focus NFe reprocessa automaticamente.', raw: text };

  return { title: text.slice(0, 120), raw: text };
}
