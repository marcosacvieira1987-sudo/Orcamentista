import AuthForm from '@/components/AuthForm';

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return <AuthForm modo="entrar" aviso={erro === 'link' ? 'O link expirou ou já foi usado. Peça outro.' : undefined} />;
}
