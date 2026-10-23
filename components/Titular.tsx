import { SITE } from '@/lib/site';

// Identificação de quem presta o serviço, a partir de lib/site.ts.
export default function Titular() {
  const t = SITE.titular;
  if (!t.nome) return <p className="callout warn small">Identificação do titular do serviço (nome, NIF, morada e email) a completar antes do lançamento.</p>;
  return <p>{t.nome}{t.nif ? `, NIF ${t.nif}` : ''}{t.morada ? `, ${t.morada}` : ''}.{t.email ? <> Contacto: <a href={`mailto:${t.email}`}>{t.email}</a>.</> : null}</p>;
}
