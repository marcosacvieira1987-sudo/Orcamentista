'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

type Modo = 'entrar' | 'registar' | 'recuperar' | 'nova';

const TITULOS: Record<Modo, [string, string, string]> = {
  entrar: ['Entrar', 'Os seus orçamentos, a partir de fotos.', 'Entrar'],
  registar: ['Criar conta', 'Configure a empresa e o preçário, e faça o primeiro orçamento em minutos.', 'Criar conta'],
  recuperar: ['Recuperar acesso', 'Enviamos um link para definir uma nova palavra-passe.', 'Enviar link'],
  nova: ['Nova palavra-passe', 'Escolha uma palavra-passe com pelo menos 8 caracteres.', 'Guardar']
};

function traduz(msg: string) {
  if (/invalid login/i.test(msg)) return 'Email ou palavra-passe errados.';
  if (/not confirmed/i.test(msg)) return 'Confirme primeiro o seu email (veja a caixa de entrada).';
  if (/already registered|already exists/i.test(msg)) return 'Já existe uma conta com este email.';
  if (/password/i.test(msg) && /(short|least|weak)/i.test(msg)) return 'A palavra-passe é fraca. Use pelo menos 8 caracteres.';
  if (/rate|too many/i.test(msg)) return 'Demasiadas tentativas. Espere um pouco.';
  if (/database error/i.test(msg)) return `A base de dados recusou o registo: confirme que a migração SQL foi aplicada no Supabase. (${msg})`;
  if (/sending.*email|smtp/i.test(msg)) return `Não foi possível enviar o email de confirmação. Tente dentro de minutos. (${msg})`;
  if (/failed to fetch|network|load failed/i.test(msg)) return `Sem ligação ao servidor de contas: verifique a ligação à internet e as variáveis do Supabase no Vercel. (${msg})`;
  if (/invalid api key|no api key|apikey/i.test(msg)) return `A chave do Supabase configurada no Vercel não é válida. (${msg})`;
  // mostra o detalhe técnico para se perceber a causa
  return `Não foi possível continuar. Tente de novo. (${msg || 'erro desconhecido'})`;
}

export default function AuthForm({ modo, aviso }: { modo: Modo; aviso?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [aceito, setAceito] = useState(false);
  const [erro, setErro] = useState(aviso || '');
  const [ok, setOk] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [titulo, lead, botao] = TITULOS[modo];

  async function submeter(ev: React.FormEvent) {
    ev.preventDefault();
    setErro(''); setOk(''); setOcupado(true);
    const sb = supabaseBrowser();
    const base = window.location.origin;
    try {
      if (modo === 'entrar') {
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        router.replace('/orcamentos'); router.refresh(); return;
      }
      if (modo === 'registar') {
        if (!aceito) { setErro('Para criar a conta, aceite a política de privacidade.'); return; }
        if (pass.length < 8) { setErro('Use pelo menos 8 caracteres na palavra-passe.'); return; }
        const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { empresa: empresa.trim() }, emailRedirectTo: `${base}/auth/confirmar?next=/configuracao` } });
        if (error) throw error;
        if (data.session) { router.replace('/configuracao'); router.refresh(); return; }
        setOk('Conta criada. Enviámos um email para confirmar o endereço: abra o link para entrar.');
        return;
      }
      if (modo === 'recuperar') {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${base}/auth/confirmar?next=/nova-password` });
        if (error) throw error;
        setOk('Se existir uma conta com este email, vai receber um link dentro de minutos.');
        return;
      }
      if (pass.length < 8) { setErro('Use pelo menos 8 caracteres.'); return; }
      const { error } = await sb.auth.updateUser({ password: pass });
      if (error) throw error;
      router.replace('/orcamentos'); router.refresh();
    } catch (e) {
      setErro(traduz(e instanceof Error ? e.message : String(e)));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main className="auth">
      <section className="intro"><Link href="/" className="auth-marca" aria-label="Página inicial do Prumo"><span className="auth-prumo" aria-hidden="true" />Prumo</Link><h1>{titulo}</h1><p className="lead">{lead}</p></section>
      <form onSubmit={submeter} noValidate>
        <section className="sheet">
          {modo === 'registar' ? (
            <label className="f"><span className="lab">Nome da empresa</span><input value={empresa} onChange={(e) => setEmpresa(e.target.value)} autoComplete="organization" placeholder="Ex.: Silva & Filhos Remodelações" /></label>
          ) : null}
          {modo !== 'nova' ? (
            <label className="f"><span className="lab">Email</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" /></label>
          ) : null}
          {modo !== 'recuperar' ? (
            <label className="f"><span className="lab">Palavra-passe</span><input type="password" required value={pass} onChange={(e) => setPass(e.target.value)} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} minLength={8} /></label>
          ) : null}
        </section>
        {modo === 'registar' ? (
          <label className="check"><input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} /> <span>Li e aceito a <Link href="/privacidade" target="_blank">política de privacidade</Link>. As fotos e os dados dos orçamentos são só seus.</span></label>
        ) : null}
        {erro ? <p className="erro" role="alert">{erro}</p> : null}
        {ok ? <p className="ok-msg" role="status">{ok}</p> : null}
        <button className="btn primary lg" disabled={ocupado}>{ocupado ? 'Um momento…' : botao}</button>
      </form>
      <p className="alt">
        {modo === 'entrar' ? <><Link href="/registar">Criar conta</Link> · <Link href="/recuperar">Esqueci-me da palavra-passe</Link></> : <Link href="/entrar">Já tenho conta: entrar</Link>}
      </p>
    </main>
  );
}
