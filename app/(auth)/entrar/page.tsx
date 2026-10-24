import AuthForm from '@/components/AuthForm';

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return <AuthForm modo="entrar" aviso={erro === 'link' ? 'O link expirou, já foi usado ou foi aberto noutro browser. Se estava a confirmar o email, entre com a sua palavra-passe. Para recuperar a palavra-passe, peça outro link e abra-o neste browser.' : undefined} />;
}
