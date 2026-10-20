// Redirecionamento relativo: não depende do host que o servidor julga ter (proxies, localhost vs 127.0.0.1).
export const redirecionar = (path: string) => new Response(null, { status: 303, headers: { Location: path } });
