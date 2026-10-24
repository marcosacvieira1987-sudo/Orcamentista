// Imitação da API de mensagens (streaming SSE) só para testar a ligação da app. Respostas fixas.
import http from 'node:http';
const leitura = { fotos: [1,2,3,4,5,6].map((n) => ({ n, divisao: n < 4 ? 'Interior' : 'Cobertura', descricao: ['Ombreira junto à varanda com tinta destacada e salitre.', 'Teto com pintura empolada ao longo de uma linha de humidade.', 'Manchas de humidade na base da parede, junto ao pavimento.', 'Platibanda com fissuras contínuas no reboco.', 'Clarabóia com vedante aberto entre painéis.', 'Terraço com lajetas cobertas de musgo e juntas abertas.'][n-1] })),
  divisoes: [{ nome: 'Interior', elementos: ['tetos', 'paredes'], materiais: ['estuque'], estado: ['humidade'] }, { nome: 'Cobertura', elementos: ['platibanda', 'clarabóia'], materiais: ['reboco'], estado: ['fissuras'] }],
  nao_consigo_ver: ['tubo de queda'], preciso_confirmar: [], trabalhos_provaveis: [], cotas_lidas: [], alertas: [] };
const orcamento = {
  titulo: 'Reabilitação do edifício',
  apresentacao: 'Exma. Senhora Maria Fernandes,\n\nNa visita encontrámos um padrão claro: **a água está a entrar no edifício** e já deixou marcas no interior.\n\nPor isso propomos uma **intervenção integrada**: primeiro fechar as entradas de água, depois recuperar o interior.',
  encontramos: 'Fotografias tiradas na visita. **Cada inverno sem intervenção** mantém estes pontos expostos à chuva.',
  fotos_encontramos: [1, 2, 4, 5],
  fases: [{ titulo: 'Fechar as entradas de água', descricao: 'Cobertura, clarabóia e terraço.' }, { titulo: 'Recuperar o interior', descricao: 'Reparação e pintura com as paredes já secas.' }],
  capitulos: [
    { nome: 'Telhado e platibandas', subtitulo: 'Cobertura', descricao: 'O telhado é a primeira barreira contra a chuva.', estado: ['Platibandas com fissuras no reboco', 'Cumeeiras com argamassa degradada'], fotos: [4], fase: 1, prazo: '2 semanas', nao_incluido: ['Substituição integral do telhado'],
      linhas: [{ descricao: 'Tratamento de fissuras das platibandas com rede e tinta elástica', unidade: 'm2', quantidade: 40, qtd_origem: 'estimada', preco: 35, fonte: 'estimativa', faixa_min: 25, faixa_max: 45 }, { descricao: 'Revisão de cumeeiras com argamassa hidrófuga', unidade: 'ml', quantidade: 18, qtd_origem: 'estimada', preco: 28, fonte: 'estimativa', faixa_min: 20, faixa_max: 35 }] },
    { nome: 'Clarabóia', subtitulo: '', descricao: 'Nova selagem das juntas entre painéis.', estado: ['Vedantes abertos nas juntas'], fotos: [5], fase: 1, prazo: '1 semana', nao_incluido: ['Substituição de painéis'],
      linhas: [{ descricao: 'Remoção de vedantes degradados e nova selagem', unidade: 'vg', quantidade: 1, qtd_origem: 'medida', preco: 650, fonte: 'estimativa', faixa_min: 500, faixa_max: 800 }] },
    { nome: 'Reparações interiores', subtitulo: 'Pisos 1 a 3', descricao: 'A reparação é feita com o suporte tratado e seco.', estado: ['Tetos com pintura empolada', 'Manchas de humidade junto ao pavimento'], fotos: [1, 2], fase: 2, prazo: '3 semanas', nao_incluido: ['Reparações estruturais'],
      linhas: [{ descricao: 'Pintura de paredes (tinta plástica, 2 demãos)', unidade: 'm2', quantidade: 120, qtd_origem: 'medida', preco: 9, fonte: 'propria', ref: 'Pintura de paredes (tinta plástica, 2 demãos)' }, { descricao: 'Reparação de estuque e tratamento de fissuras', unidade: 'm2', quantidade: 25, qtd_origem: 'estimada', preco: 18, fonte: 'estimativa', faixa_min: 14, faixa_max: 24 }] }
  ],
  nao_incluido: ['Reparação do tubo de queda', 'IVA à taxa legal em vigor'], pressupostos: ['Água e eletricidade disponíveis'], a_confirmar: ['Estado do tubo de queda'], prazo: '6 semanas'
};
const perguntas = { perguntas: [{ id: 'q1', tema: 'Âmbito', pergunta: 'A pintura interior é integral?', tipo: 'sim_nao', opcoes: [], unidade: '', porque: '' }] };
http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const j = JSON.parse(body || '{}');
    const content = j.messages?.[0]?.content || [];
    const prompt = content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const tipo = /textos fixos das propostas/.test(prompt) ? 'textos' : /fotografias de uma obra/.test(prompt) ? 'leitura' : /perguntas que ainda faltam/.test(prompt) ? 'perguntas' : /PEDIDO DE ALTERAÇÃO/.test(prompt) ? 'ajuste' : /mapa de quantidades/.test(prompt) ? 'orcamento' : 'mensagem';
    console.log(JSON.stringify({ tipo, completa: /PROPOSTA COMPLETA/.test(prompt), legenda15: /15 palavras/.test(prompt), semIvaRegra: /nunca menciones o IVA/i.test(prompt), imgs: content.filter((b) => b.type === 'image').length }));
    const texto = tipo === 'mensagem' ? 'Bom dia. Segue a proposta.' : tipo === 'textos' ? JSON.stringify({ apresentacao: 'Fazemos remodelações em Lisboa há 15 anos.\n\nTrabalhamos com equipa própria.', condicoes: 'Início acertado na adjudicação.\nMateriais do cliente em obra a tempo.', garantia: 'Corrigimos defeitos de execução sem custos.', slogan: 'Obras bem feitas' }) : JSON.stringify(tipo === 'leitura' ? leitura : tipo === 'perguntas' ? perguntas : orcamento);
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
    ev('message_start', { message: { id: 'msg_x', type: 'message', role: 'assistant', model: j.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10000, output_tokens: 0 } } });
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
    for (let i = 0; i < texto.length; i += 300) ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: texto.slice(i, i + 300) } });
    ev('content_block_stop', { index: 0 });
    ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 4000 } });
    ev('message_stop', {});
    res.end();
  });
}).listen(4010, () => console.log('mock em 4010'));
