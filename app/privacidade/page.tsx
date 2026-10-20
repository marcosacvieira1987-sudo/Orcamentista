import Link from 'next/link';
import { PRODUTO } from '@/lib/marca';

// RASCUNHO: rever com um jurista antes de abrir ao público (responsável pelo tratamento, contactos, prazos).
export default function Privacidade() {
  return (
    <main className="wrap legal">
      <section className="intro"><span className="eyebrow">{PRODUTO}</span><h1>Política de privacidade</h1><p className="lead">Versão provisória.</p></section>
      <h2>Que dados tratamos</h2>
      <ul>
        <li>Dados da conta: email e palavra-passe (guardada cifrada).</li>
        <li>Dados da empresa que introduz: nome, NIF, contactos, morada, logótipo, condições e preçário.</li>
        <li>Dados dos orçamentos: descrição da obra, localidade, nome do dono de obra, notas, medidas e fotografias da obra.</li>
      </ul>
      <h2>Para que servem</h2>
      <p>Só para prestar o serviço: guardar os seus orçamentos, gerar o esboço com inteligência artificial e produzir a proposta em PDF. Não vendemos nem partilhamos dados para publicidade.</p>
      <h2>Onde ficam e quem os vê</h2>
      <p>A base de dados e as fotografias ficam alojadas na União Europeia, com acesso restrito: cada conta só consegue ler os seus próprios dados. Para montar o esboço, o texto do pedido e as fotografias são enviados à API da Anthropic (Claude), que atua como subcontratante e não usa estes dados para treinar modelos.</p>
      <h2>Os seus direitos</h2>
      <p>Na página da empresa pode descarregar todos os seus dados e apagar a conta, com todos os orçamentos e fotografias, a qualquer momento. Para outros pedidos (acesso, retificação, oposição), contacte-nos. Pode também apresentar reclamação à CNPD.</p>
      <h2>Dados de terceiros</h2>
      <p>Ao introduzir dados do dono de obra (por exemplo o nome) ou fotografias de uma casa, é o profissional que decide esse tratamento e deve informar o cliente.</p>
      <p><Link href="/registar">Voltar</Link></p>
    </main>
  );
}
