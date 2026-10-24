// Enquanto a lista carrega: o esqueleto dos cartões, sem saltos na página.
export default function ACarregar() {
  return (
    <div className="wrap wrap-lista" aria-busy="true" aria-label="A carregar os orçamentos">
      <div className="esq esq-topo" />
      <div className="esq esq-titulo" />
      <div className="cartoes">{[0, 1, 2].map((i) => <div key={i} className="esq esq-cartao" />)}</div>
    </div>
  );
}
