'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { IconFile, IconLogout, IconMenu, IconSettings, IconUsers } from '@/components/Icones/Icones';
import { useToast } from '@/components/Toast/Toast';
import { mensagemDeErro } from '@/lib/errors';
import { useServices } from '@/lib/services/useServices';
import styles from './DashboardShell.module.css';

const ICONS = { file: IconFile, users: IconUsers, settings: IconSettings } as const;

export interface NavItem {
  label: string;
  href: string;
  icon: keyof typeof ICONS;
}

interface DashboardShellProps {
  title: string;
  userName: string;
  roleLabel: string;
  nav: NavItem[];
  children: React.ReactNode;
}

/**
 * Shell persistente (design.md §5): topbar + sidebar renderizados uma vez no layout de cada
 * papel e compartilhados por aluno e coordenação — só o menu muda.
 */
export function DashboardShell({ title, userName, roleLabel, nav, children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { auth } = useServices();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleLogout() {
    try {
      await auth.signOut();
      router.replace('/login');
      router.refresh();
    } catch (err) {
      toast.error(mensagemDeErro(err));
    }
  }

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.hamburger}
          onClick={() => setDrawerOpen((v) => !v)}
          aria-label="Abrir menu"
          aria-expanded={drawerOpen}
        >
          <IconMenu />
        </button>
        <span className={styles.logo}>Cert Manager</span>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.account}>
          <div className={styles.accountInfo}>
            <strong>{userName}</strong>
            <span>{roleLabel}</span>
          </div>
          <button type="button" className={styles.logout} onClick={handleLogout}>
            <IconLogout size={16} /> Sair
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <nav
          className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ''}`}
          aria-label="Navegação principal"
        >
          {nav.map((item) => {
            const Icon = ICONS[item.icon];
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${active ? styles.navActive : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => setDrawerOpen(false)}
              >
                <Icon /> {item.label}
              </Link>
            );
          })}
        </nav>
        {drawerOpen && <div className={styles.backdrop} onClick={() => setDrawerOpen(false)} />}
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
