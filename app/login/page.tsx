'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mensagemDeErro } from '@/lib/errors';
import { useServices } from '@/lib/services/useServices';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { auth } = useServices();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const role = await auth.signIn(email.trim(), password);
      router.replace(role === 'coordinator' ? '/dashboard/coordinator' : '/dashboard/student');
      router.refresh();
    } catch (err) {
      setError(mensagemDeErro(err, 'Erro ao fazer login.'));
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      <div className="auth-card">
        <h1 className={styles.title}>Acesso ao Sistema</h1>
        <p className={styles.subtitle}>Gerenciamento de Certificados</p>

        {error && <div className="alert-error" role="alert">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">E-mail</label>
            <input
              id="email"
              className="form-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Senha</label>
            <input
              id="password"
              className="form-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary btn-block" disabled={loading}>
            {loading ? <><span className="spinner" /> Entrando…</> : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}