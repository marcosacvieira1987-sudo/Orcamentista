// Textos da página de apresentação (/) num só sítio, para mudar sem mexer no desenho.
// Só se promete o que o app já faz. Os valores do exemplo são fictícios.

export type Plano = {
  id: 'pro' | 'premium';
  nome: string;
  preco: number;
  para: string;
  destaque?: string;
  inclui: string[];
  exemplo: { href: string; rotulo: string };
};

export type Negocio = {
  nome: string;
  frase: string;
  servicos: { titulo: string; texto: string }[];
  contacto: { rotulo: string; href: string };
};

export const SITE = {
  hero: {
    eyebrow: 'Para profissionais de remodelação',
    titulo: ['Fotografe a obra.', 'A proposta monta-se.'],
    texto: 'A inteligência artificial lê as fotografias, propõe as quantidades e aplica os preços do seu preçário. Revê, ajusta e envia ao cliente um PDF com a sua marca, por WhatsApp ou email.',
    cta: 'Experimentar 14 dias grátis',
    secundario: 'Ver uma proposta',
  },
  factos: [
    { valor: '6', rotulo: 'passos do telemóvel ao PDF' },
    { valor: '2', rotulo: 'modelos de proposta' },
    { valor: '100%', rotulo: 'português de Portugal' },
    { valor: 'UE', rotulo: 'dados alojados na Europa' },
  ],
  passos: [
    { n: '01', titulo: 'Fotografe e descreva', texto: 'Tire as fotografias na obra e conte o que o cliente quer. Pode ditar por voz em vez de escrever.' },
    { n: '02', titulo: 'A IA monta o esboço', texto: 'Lê as fotos, faz as perguntas que faltam e organiza capítulos, quantidades e preços a partir do seu preçário.' },
    { n: '03', titulo: 'Reveja e envie', texto: 'Ajuste o que quiser, por escrito ou por voz. Gere o PDF e envie o link ao cliente por WhatsApp ou email.' },
  ],
  montra: {
    eyebrow: 'O que o seu cliente recebe',
    titulo: 'Uma proposta que ganha obras.',
    texto: 'Clara para o cliente, completa para si: o que encontrou, o que vai fazer, quanto custa e como se paga.',
    paginas: [
      { src: '/landing/pagina-01.webp', legenda: 'Capa com a sua marca' },
      { src: '/landing/pagina-03.webp', legenda: 'Carta de apresentação' },
      { src: '/landing/pagina-04.webp', legenda: 'Resumo por fases' },
      { src: '/landing/pagina-06.webp', legenda: 'Capítulos detalhados' },
      { src: '/landing/pagina-10.webp', legenda: 'Garantia e seguro' },
      { src: '/landing/pagina-11.webp', legenda: 'Adjudicação e pagamentos' },
    ],
    nota: 'Exemplo com empresa e valores fictícios.',
  },
  funcoes: [
    { icone: 'foto', titulo: 'Lê as fotografias', texto: 'Identifica o estado da obra e os trabalhos prováveis, foto a foto.' },
    { icone: 'lista', titulo: 'O seu preçário', texto: 'Os preços são os seus. A IA só usa a sua tabela e assinala o que falta.' },
    { icone: 'voz', titulo: 'Ditado por voz', texto: 'Descreva a obra e peça ajustes a falar, mesmo de luvas calçadas.' },
    { icone: 'envio', titulo: 'WhatsApp e email', texto: 'O cliente recebe um link para abrir o PDF no telemóvel, sem anexos pesados.' },
    { icone: 'numero', titulo: 'Numeração automática', texto: 'Cada proposta com o seu número, por ordem, com o prefixo da empresa.' },
    { icone: 'copia', titulo: 'Duplicar orçamentos', texto: 'Obra parecida? Duplique, mude o necessário e envie.' },
    { icone: 'custo', titulo: 'Custo à vista', texto: 'Vê quanto custou a IA em cada orçamento. Sem surpresas.' },
    { icone: 'escudo', titulo: 'Dados protegidos', texto: 'Cada conta só vê os seus dados. Pode exportar ou apagar tudo quando quiser.' },
  ],
  planos: [
    {
      id: 'pro', nome: 'Pro', preco: 59,
      para: 'Para quem quer responder depressa.',
      inclui: [
        'Proposta rápida: resumo, mapa de quantidades e condições',
        'Leitura das fotografias pela IA',
        'O seu preçário e a sua marca no PDF',
        'Envio por WhatsApp e email',
        'Ditado por voz',
        'Numeração e duplicação de orçamentos',
      ],
      exemplo: { href: '/landing/exemplo-proposta-rapida.pdf', rotulo: 'Ver exemplo da proposta rápida' },
    },
    {
      id: 'premium', nome: 'Premium', preco: 180, destaque: 'A proposta completa',
      para: 'Para quem quer ganhar a obra pela apresentação.',
      inclui: [
        'Tudo o que está no Pro',
        'Capa institucional e carta de apresentação',
        '"O que encontrámos" com as fotografias da obra',
        'Capítulos com estado atual, trabalhos e não incluídos',
        'Execução por fases, com prazos e valores',
        'Plano de pagamentos, IBAN e folha de adjudicação',
        'Garantia e seguro em destaque',
      ],
      exemplo: { href: '/landing/exemplo-proposta-completa.pdf', rotulo: 'Ver exemplo da proposta completa' },
    },
  ] satisfies Plano[],
  notaPlanos: 'Valores por mês, sem IVA. Os primeiros 14 dias são grátis, com tudo incluído e sem cartão. Depois escolhe o plano; pode mudar ou cancelar quando quiser.',
  perguntas: [
    { p: 'Preciso de saber de informática?', r: 'Não. Se tira fotografias e envia mensagens no telemóvel, consegue usar. O app guia-o passo a passo.' },
    { p: 'Os preços são inventados pela IA?', r: 'Não. A IA usa o seu preçário. Quando um trabalho não está na tabela, fica assinalado para confirmar antes de enviar.' },
    { p: 'E se a IA errar uma medição?', r: 'Revê todas as linhas antes de gerar o PDF. Pode corrigir à mão ou pedir o ajuste por escrito ou por voz.' },
    { p: 'Funciona no telemóvel?', r: 'Foi pensado primeiro para o telemóvel, para usar na obra. No computador, a revisão abre em duas colunas.' },
    { p: 'Os dados dos meus clientes ficam seguros?', r: 'Ficam alojados na União Europeia e cada conta só acede aos seus. Pode exportar ou apagar tudo a qualquer momento.' },
  ],
  final: { titulo: 'O próximo orçamento pode estar pronto hoje.', cta: 'Começar agora' },
  // Outros negócios: preencher quando houver os dados. Com null, a secção não aparece.
  negocio: null as Negocio | null,
  // Email ou página de contacto público. Vazio: não aparece no rodapé.
  contacto: 'mmgs.geral@gmail.com',
  // Quem vende o serviço (aparece nos termos e na privacidade). Preencher antes de cobrar.
  titular: { nome: 'MMGS Unipessoal Lda', nif: '519696158', morada: 'R. Carlos Amaro de Matos 50, 2700-162 Amadora', email: 'mmgs.geral@gmail.com' },
  // obrigatório em Portugal para quem vende online
  livroReclamacoes: 'https://www.livroreclamacoes.pt/Inicio/',
};
