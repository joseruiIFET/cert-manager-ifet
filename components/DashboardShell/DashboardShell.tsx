'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { IconFile, IconInfo, IconLogout, IconMenu, IconSettings, IconUsers } from '@/components/Icones/Icones';
import { useToast } from '@/components/Toast/Toast';
import { mensagemDeErro } from '@/lib/errors';
import { useServices } from '@/lib/services/useServices';
import styles from './DashboardShell.module.css';

const ICONS = { file: IconFile, users: IconUsers, settings: IconSettings, info: IconInfo } as const;

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
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const prevDrawerOpenRef = useRef(false);

  useEffect(() => {
    /* Acessibilidade do drawer mobile (design.md §9):
       Ao abrir, move o foco para o primeiro link e prende a navegação por Tab no menu (focus trap).
       A tecla Esc fecha o drawer e retorna o foco para o botão acionador (hamburger). */
    if (drawerOpen) {
      const focusable = () =>
        navRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled])'
        ) ?? [];

      const items = focusable();
      items[0]?.focus();

      function onKey(e: KeyboardEvent) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setDrawerOpen(false);
          return;
        }
        if (e.key === 'Tab') {
          const navItems = Array.from(focusable());
          if (navItems.length === 0) return;
          const first = navItems[0];
          const last = navItems[navItems.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }

      document.addEventListener('keydown', onKey);
      return () => {
        document.removeEventListener('keydown', onKey);
      };
    } else if (prevDrawerOpenRef.current) {
      hamburgerRef.current?.focus();
    }
  }, [drawerOpen]);

  useEffect(() => {
    prevDrawerOpenRef.current = drawerOpen;
  }, [drawerOpen]);

  async function handleLogout() {
    try {
      await auth.signOut();
      router.replace('/login');
      router.refresh();
    } catch (err) {
      toast.error(mensagemDeErro(err, 'Não foi possível encerrar a sessão. Por favor, tente novamente.'));
    }
  }

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <button
          ref={hamburgerRef}
          type="button"
          className={styles.hamburger}
          onClick={() => setDrawerOpen((v) => !v)}
          aria-label="Abrir menu"
          aria-expanded={drawerOpen}
          aria-controls="main-nav"
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
          ref={navRef}
          id="main-nav"
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
