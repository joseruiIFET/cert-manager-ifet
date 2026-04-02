'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// ATENÇÃO: A linha abaixo é a que estava faltando ou errada
export default function StudentLayout({ children }) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Se não tiver logado, manda pro login
        router.push('/login');
        return;
      }

      // Se está logado, libera o acesso
      setIsAuthorized(true);
    } catch (error) {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  // Enquanto verifica, mostra carregando ou nada
  if (loading) {
    return <div style={{padding: 50, textAlign: 'center'}}>Carregando...</div>;
  }

  // Se não autorizado, não renderiza nada (o router.push já aconteceu)
  if (!isAuthorized) return null;

  // Se passou, renderiza a página do aluno
  return <>{children}</>;
}