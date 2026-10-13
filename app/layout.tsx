import type { Metadata } from 'next';
import { DM_Sans } from 'next/font/google';
import { ToastProvider } from '@/components/Toast/Toast';
import './globals.css';

// Fonte por next/font: sem @import bloqueante (performance.md §6).
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'Cert Manager',
  description: 'Gerenciador de Certificados',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={dmSans.variable}>
      <body suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}