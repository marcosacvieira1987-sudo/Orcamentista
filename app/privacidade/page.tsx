import type { Metadata } from 'next';
import Link from 'next/link';
import Titular from '@/components/Titular';
import { PRODUTO } from '@/lib/marca';

export const metadata: Metadata = { title: `Política de privacidade · ${PRODUTO}` };

// RASCUNHO: rever com um jurista antes de abrir ao público (responsável pelo tratamento, contactos, prazos).
export default function Privacidade() {
  return (
    <main className="wrap legal">
      <section className="intro"><span className="eyebrow">{PRODUTO}</span><h1>Política de privacidade</h1><p className="lead">Versão provisória.</p></section>
      <h2>Responsável pelo tratamento</h2>
      <Titular />
      <h2>Que dados tratamos</h2>
      <ul>
        <li>Dados da conta: email e palavra-passe (guardada cifrada).</li>
        <li>Dados da empresa que introduz: nome, NIF, contactos, morada, logótipo, condições e preçário.</li>
        <li>Dados dos orçamentos: descrição da obra, localidade, nome e contactos do dono de obra, notas, medidas e fotografias da obra.</li>
        <li>Página da proposta: quando envia uma proposta por link, guardamos uma cópia do que foi enviado. Se o cliente a aceitar, registamos o nome que ele indicar, a nota opcional e a data. Contamos quantas vezes a página foi aberta, sem cookies nem dados de quem a abre.</li>
        <li>Medidas de utilização: o tempo de trabalho em cada orçamento e o número de pedidos à inteligência artificial, para controlar custos e melhorar o produto. Só usamos estes números de forma agregada e anónima.</li>
        <li>Dados de faturação, se subscrever um plano: nome da empresa, NIF, morada, email e histórico de pagamentos. Os dados do cartão ou da conta bancária são tratados pelo Stripe e nunca passam por nós.</li>
      </ul>
      <h2>Para que servem</h2>
      <p>Só para prestar o serviço: guardar os seus orçamentos, gerar o esboço com inteligência artificial e produzir a proposta em PDF. Não vendemos nem partilhamos dados para publicidade.</p>
      <h2>Onde ficam e quem os vê</h2>
      <p>A base de dados e as fotografias ficam alojadas na União Europeia, com acesso restrito: cada conta só consegue ler os seus próprios dados. Para montar o esboço, o texto do pedido e as fotografias são enviados à API da Anthropic (Claude), que atua como subcontratante e não usa estes dados para treinar modelos. Os pagamentos são processados pelo Stripe e o app está alojado no Vercel, com as funções a correr em Frankfurt. Os avisos por email, quando ativos, são enviados pelo Resend. Todos atuam como subcontratantes.</p>
      <h2>Cookies</h2>
      <p>Usamos só os cookies necessários para manter a sessão iniciada. Não usamos cookies de publicidade nem de análise, nem ferramentas de terceiros para seguir visitantes. As letras são servidas pelo próprio site.</p>
      <h2>Quanto tempo os guardamos</h2>
      <p>Enquanto a conta existir. Ao apagar a conta, os orçamentos, as fotografias e os PDF são apagados de imediato. Os registos de faturação são guardados pelo prazo exigido pela lei fiscal (10 anos).</p>
      <h2>Os seus direitos</h2>
      <p>Na página da empresa pode descarregar todos os seus dados e apagar a conta, com todos os orçamentos e fotografias, a qualquer momento. Para outros pedidos (acesso, retificação, oposição), contacte-nos. Pode também apresentar reclamação à CNPD.</p>
      <h2>Dados de terceiros</h2>
      <p>Ao introduzir dados do dono de obra (por exemplo o nome) ou fotografias de uma casa, é o profissional que decide esse tratamento e deve informar o cliente. O mesmo vale para os dados que o cliente deixa ao aceitar uma proposta: tratamo-los por conta do profissional, só para lhe mostrar a aceitação.</p>
      <p>Ver também os <Link href="/termos">termos de utilização</Link>. <Link href="/">Voltar ao início</Link></p>
    </main>
  );
}
