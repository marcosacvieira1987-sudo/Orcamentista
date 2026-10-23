import type { Metadata } from 'next';
import Link from 'next/link';
import Titular from '@/components/Titular';
import { PRODUTO } from '@/lib/marca';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: `Termos de utilização · ${PRODUTO}` };

// RASCUNHO: rever com um jurista antes de começar a cobrar.
export default function Termos() {
  const [pro, premium] = SITE.planos;
  return (
    <main className="wrap legal">
      <section className="intro"><span className="eyebrow">{PRODUTO}</span><h1>Termos de utilização</h1><p className="lead">Versão provisória.</p></section>

      <h2>1. Quem presta o serviço</h2>
      <Titular />

      <h2>2. O serviço</h2>
      <p>O {PRODUTO} ajuda profissionais de obras e remodelação a preparar propostas de orçamento: guarda os dados da empresa e o preçário, lê as fotografias da obra com inteligência artificial, propõe um esboço com quantidades e preços e produz a proposta em PDF. Destina-se a uso profissional (empresas e trabalhadores independentes).</p>

      <h2>3. Conta</h2>
      <p>Cada conta é de uma empresa ou profissional. Os dados indicados devem ser verdadeiros e a palavra-passe deve ficar só consigo. É responsável pelo que for feito com a sua conta.</p>

      <h2>4. Período experimental</h2>
      <p>As contas novas têm 14 dias grátis, com todas as funções, sem pedir cartão. No fim, para continuar a usar a inteligência artificial é preciso escolher um plano. Os orçamentos e PDF já feitos continuam acessíveis.</p>

      <h2>5. Planos e pagamento</h2>
      <ul>
        <li><strong>{pro.nome}</strong>: {pro.preco} € por mês, mais IVA. Proposta rápida.</li>
        <li><strong>{premium.nome}</strong>: {premium.preco} € por mês, mais IVA. Inclui também a proposta completa.</li>
      </ul>
      <p>O pagamento é mensal e antecipado, processado pelo Stripe, e renova-se automaticamente até ser cancelado. Pode mudar de plano a qualquer momento: o acerto do valor é proporcional ao tempo que falta no mês. Alterações de preço são comunicadas por email com pelo menos 30 dias de antecedência e só se aplicam a partir da renovação seguinte.</p>

      <h2>6. Cancelamento e falta de pagamento</h2>
      <p>Pode cancelar a qualquer momento no menu Plano, em "Gerir subscrição". O plano fica ativo até ao fim do mês já pago e não há reembolso de meses parciais. Se uma cobrança falhar, o Stripe tenta de novo durante alguns dias; se continuar sem pagamento, a inteligência artificial fica em pausa até o pagamento ser regularizado.</p>

      <h2>7. A inteligência artificial e as suas propostas</h2>
      <p>O esboço feito pela inteligência artificial é uma ajuda e pode conter erros de leitura, de medição ou de preço. Antes de enviar uma proposta, o profissional revê e confirma quantidades, preços, textos e condições, e é o único responsável pelo que propõe ao seu cliente. Para manter custos razoáveis existe um limite diário de pedidos à inteligência artificial por conta.</p>

      <h2>8. Os seus dados</h2>
      <p>Os dados da empresa, o preçário, os orçamentos e as fotografias são seus. Usamo-los só para prestar o serviço, como descrito na <Link href="/privacidade">política de privacidade</Link>. Pode descarregá-los ou apagar a conta a qualquer momento; apagar a conta cancela também a subscrição.</p>

      <h2>9. Uso aceitável</h2>
      <p>Não é permitido usar o serviço para fins ilegais, carregar conteúdos de terceiros sem autorização, tentar aceder a dados de outras contas, nem sobrecarregar ou contornar os limites do serviço. Nesses casos a conta pode ser suspensa.</p>

      <h2>10. Disponibilidade e responsabilidade</h2>
      <p>Fazemos o possível para manter o serviço disponível e os dados seguros, mas podem existir interrupções para manutenção ou por falhas de fornecedores. Salvo dolo ou culpa grave, a nossa responsabilidade fica limitada ao valor pago pela conta nos 12 meses anteriores.</p>

      <h2>11. Alterações a estes termos</h2>
      <p>Se estes termos mudarem, avisamos por email ou no próprio app com pelo menos 30 dias de antecedência. Pode cancelar antes de as alterações entrarem em vigor.</p>

      <h2>12. Lei aplicável e reclamações</h2>
      <p>Aplica-se a lei portuguesa. Pode apresentar reclamação no <a href={SITE.livroReclamacoes} target="_blank" rel="noopener">Livro de Reclamações Eletrónico</a>.</p>

      <p><Link href="/">Voltar ao início</Link></p>
    </main>
  );
}
