import { DashboardShell } from '@/components/DashboardShell/DashboardShell';
import { requireProfile } from '@/lib/session';

export default async function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <DashboardShell
      title="Coordenação"
      userName={profile.fullName || profile.email}
      roleLabel="Coordenação"
      nav={[
        { label: 'Análise', href: '/dashboard/coordinator', icon: 'users' },
        { label: 'Configurar atividades', href: '/dashboard/coordinator/activities', icon: 'settings' },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
