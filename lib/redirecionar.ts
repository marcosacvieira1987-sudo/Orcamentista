// Redirecionamento relativo: não depende do host que o servidor julga ter (proxies, localhost vs 127.0.0.1).
export const redirecionar = (path: string) => new Response(null, { status: 303, headers: { Location: path } });

// Endereço público do site, como o browser o vê (para os links de regresso do Stripe).
// Só aceita o Origin do browser se for o do próprio site (o host do pedido).
export function origemDoPedido(req: Request) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const o = req.headers.get('origin');
  if (o && host && /^https?:\/\/[^/]+$/.test(o) && new URL(o).host === host) return o;
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}
