'use client';
// Conta a visita só quando a página corre num browser e fica aberta: os robôs que geram a pré-visualização
// do link (WhatsApp, email, antivírus) não executam JavaScript e não contam como "vista pelo cliente".
import { useEffect } from 'react';

export default function RegistarVisita({ token }: { token: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      fetch(`/p/${token}/vista`, { method: 'POST', keepalive: true }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [token]);
  return null;
}
