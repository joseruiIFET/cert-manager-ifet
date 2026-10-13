import { createClient } from '@/lib/supabase/server';
import { createActivityTypesService } from '@/lib/services/activityTypesService';
import { createCertificatesService } from '@/lib/services/certificatesService';
import { requireProfile } from '@/lib/session';
import { ReviewWorkspace } from './_components/ReviewWorkspace';

/** Server shell: resumo da fila + regras + certificados do aluno inicial; o resto sob demanda. */
export default async function CoordinatorPage() {
  await requireProfile();
  const db = await createClient();
  const certificates = createCertificatesService(db);

  const [summaries, rules] = await Promise.all([
    certificates.listStudentSummaries(),
    createActivityTypesService(db).listAll(),
  ]);

  // listStudentSummaries já vem ordenado por pendências: o primeiro é o que mais precisa de atenção.
  const initialId = summaries[0]?.profile.id ?? null;
  const initialCertificates = initialId ? await certificates.listByStudent(initialId) : [];

  return (
    <ReviewWorkspace
      summaries={summaries}
      rules={rules}
      initialId={initialId}
      initialCertificates={initialCertificates}
    />
  );
}