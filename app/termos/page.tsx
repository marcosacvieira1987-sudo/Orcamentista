import type { Metadata } from 'next';
import Link from 'next/link';
import Titular from '@/components/Titular';
import { PRODUTO } from '@/lib/marca';
import { fmtDataLisboa as fmtData, fmtPreco, janelaLancamento, LIMITE_EXPERIMENTAL, ORDEM, PLANOS } from '@/lib/planos';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: `Termos de utilização · ${PRODUTO}` };

// RASCUNHO: rever com um jurista antes de começar a cobrar.
export default function Termos() {
  const { inicio, fim } = janelaLancamento();
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
      <p>As contas novas têm 14 dias grátis, sem pedir cartão, com as funções do plano Premium e até {LIMITE_EXPERIMENTAL} orçamentos com inteligência artificial para os 14 dias todos (este limite não volta a zero no início do mês). No fim, para continuar a usar a inteligência artificial é preciso escolher um plano. Os orçamentos e PDF já feitos continuam acessíveis.</p>

      <h2>5. Planos e preços</h2>
      <p>Preços sem IVA; acresce IVA à taxa legal (23 %).</p>
      <ul>
        {ORDEM.map((p) => {
          const d = PLANOS[p];
          return <li key={p}><strong>{d.nome}</strong>: {fmtPreco(d.precos.normal.mensal)} por mês ou {fmtPreco(d.precos.normal.anual)} por ano. {d.completa ? 'Proposta rápida e proposta completa' : 'Proposta rápida'}; até {d.limite} orçamentos com inteligência artificial por mês.</li>;
        })}
      </ul>
      <p>Conta como um orçamento com inteligência artificial cada orçamento em que a inteligência artificial trabalha pela primeira vez num mês de calendário (hora de Lisboa); os ajustes ao mesmo orçamento não contam outra vez e um orçamento duplicado conta como novo. Ao chegar ao limite, a inteligência artificial fica em pausa para orçamentos novos até ao início do mês seguinte, ou até mudar para um plano com limite maior. Existe ainda um limite diário de pedidos, como proteção do serviço.</p>

      <h2>6. Preço de lançamento</h2>
      <p>Entre {fmtData(inicio)} e {fmtData(fim)} (hora de Lisboa) os planos estão à venda ao preço de lançamento: {ORDEM.map((p) => `${PLANOS[p].nome} ${fmtPreco(PLANOS[p].precos.lancamento.mensal)} por mês ou ${fmtPreco(PLANOS[p].precos.lancamento.anual)} por ano`).join('; ')}, mais IVA. Quem subscreve ao preço de lançamento mantém-no nas renovações e nas mudanças de plano enquanto não cancelar; se cancelar e voltar a subscrever, aplica-se o preço normal. Os participantes no programa de testes (beta) podem aderir ao preço de lançamento sem prazo, com o primeiro mês grátis.</p>

      <h2>7. Pagamento, renovação e mudanças de plano</h2>
      <p>O pagamento é antecipado, mensal ou anual, processado pelo Stripe, e renova-se automaticamente até ser cancelado. Pode mudar de plano ou de período a qualquer momento no menu Plano: a diferença é calculada em proporção ao tempo que falta e cobrada ou creditada na hora. Alterações de preço são comunicadas por email com pelo menos 30 dias de antecedência e só se aplicam a partir da renovação seguinte.</p>

      <h2>8. Garantia de 30 dias</h2>
      <p>Na primeira compra de cada conta, se não ficar satisfeito, pode pedir o reembolso total nos 30 dias seguintes, escrevendo para o contacto indicado no ponto 1. A garantia aplica-se uma única vez por conta.</p>

      <h2>9. Cancelamento e falta de pagamento</h2>
      <p>Pode cancelar a qualquer momento no menu Plano, em "Pagamento, faturas e cancelamento". O plano fica ativo até ao fim do período já pago e, fora da garantia do ponto 8, não há reembolso de períodos parciais. Se uma cobrança falhar, o Stripe tenta de novo durante alguns dias; se continuar sem pagamento, a inteligência artificial fica em pausa até o pagamento ser regularizado.</p>

      <h2>10. A inteligência artificial e as suas propostas</h2>
      <p>O esboço feito pela inteligência artificial é uma ajuda e pode conter erros de leitura, de medição ou de preço. Antes de enviar uma proposta, o profissional revê e confirma quantidades, preços, textos e condições, e é o único responsável pelo que propõe ao seu cliente.</p>

      <h2>11. Os seus dados</h2>
      <p>Os dados da empresa, o preçário, os orçamentos e as fotografias são seus. Usamo-los só para prestar o serviço, como descrito na <Link href="/privacidade">política de privacidade</Link>. Pode descarregá-los ou apagar a conta a qualquer momento; apagar a conta cancela também a subscrição.</p>

      <h2>12. Uso aceitável</h2>
      <p>Não é permitido usar o serviço para fins ilegais, carregar conteúdos de terceiros sem autorização, tentar aceder a dados de outras contas, nem sobrecarregar ou contornar os limites do serviço. Nesses casos a conta pode ser suspensa.</p>

      <h2>13. Disponibilidade e responsabilidade</h2>
      <p>Fazemos o possível para manter o serviço disponível e os dados seguros, mas podem existir interrupções para manutenção ou por falhas de fornecedores. Salvo dolo ou culpa grave, a nossa responsabilidade fica limitada ao valor pago pela conta nos 12 meses anteriores.</p>

      <h2>14. Alterações a estes termos</h2>
      <p>Se estes termos mudarem, avisamos por email ou no próprio app com pelo menos 30 dias de antecedência. Pode cancelar antes de as alterações entrarem em vigor.</p>

      <h2>15. Lei aplicável e reclamações</h2>
      <p>Aplica-se a lei portuguesa. Pode apresentar reclamação no <a href={SITE.livroReclamacoes} target="_blank" rel="noopener">Livro de Reclamações Eletrónico</a>.</p>

      <p><Link href="/">Voltar ao início</Link></p>
    </main>
  );
}
