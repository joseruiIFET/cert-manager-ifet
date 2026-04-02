/* ARQUIVO: src/app/dashboard/coordinator/layout.js */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function CoordinatorLayout({ children }) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkPermission();
  }, []);

  async function checkPermission() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error || profile?.role !== 'coordinator') {
        // Se não for coord, expulsa
        // ATENÇÃO: Se você não rodou o script de cura, você vai cair aqui!
        router.push('/dashboard/student'); 
        return;
      }

      setIsAuthorized(true);
    } catch (error) {
      console.error(error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div style={{padding: 50, textAlign: 'center'}}>Verificando permissões...</div>;
  }

  if (!isAuthorized) return null;

  return <>{children}</>;
}