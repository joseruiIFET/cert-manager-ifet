import { createClient } from '@/lib/supabase/server';
import { createActivityTypesService } from '@/lib/services/activityTypesService';
import { createCertificatesService } from '@/lib/services/certificatesService';
import { requireProfile } from '@/lib/session';
import { StudentCertificates } from './_components/StudentCertificates';

/** Server shell: busca os dados no servidor e delega só a interação à ilha client. */
export default async function StudentPage() {
  const profile = await requireProfile();
  const db = await createClient();

  const [certificates, activityTypes] = await Promise.all([
    createCertificatesService(db).listByStudent(profile.id),
    createActivityTypesService(db).listActive(),
  ]);

  return (
    <StudentCertificates
      studentId={profile.id}
      certificates={certificates}
      activityTypes={activityTypes}
    />
  );
}
