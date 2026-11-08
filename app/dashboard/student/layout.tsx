import { DashboardShell } from '@/components/DashboardShell/DashboardShell';
import { requireProfile } from '@/lib/session';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <DashboardShell
      title="Portal do Aluno"
      userName={profile.fullName || profile.email}
      roleLabel="Aluno"
      nav={[
        { label: 'Meus certificados', href: '/dashboard/student', icon: 'file' },
        { label: 'Regras de atividades', href: '/dashboard/student/activities', icon: 'info' },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
