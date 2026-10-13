import { DashboardShell } from '@/components/DashboardShell/DashboardShell';
import { requireProfile } from '@/lib/session';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  return (
    <DashboardShell
      title="Meus certificados"
      userName={profile.fullName || profile.email}
      roleLabel="Aluno"
      nav={[{ label: 'Meus certificados', href: '/dashboard/student', icon: 'file' }]}
    >
      {children}
    </DashboardShell>
  );
}
