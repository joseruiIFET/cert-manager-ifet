import { createClient } from '@/lib/supabase/server';
import { createActivityTypesService } from '@/lib/services/activityTypesService';
import { requireProfile } from '@/lib/session';
import { StudentActivities } from './_components/StudentActivities';

/**
 * Página de regras de atividades do aluno (Server Component).
 * Carrega apenas as regras ativas — o aluno não precisa ver regras inativas.
 */
export default async function StudentActivitiesPage() {
  await requireProfile();
  const db = await createClient();

  const rules = await createActivityTypesService(db).listActive();

  return <StudentActivities rules={rules} />;
}
