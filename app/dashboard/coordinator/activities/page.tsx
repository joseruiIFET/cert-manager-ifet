import { createClient } from '@/lib/supabase/server';
import { createActivityTypesService, createCoursesService } from '@/lib/services/activityTypesService';
import { requireProfile } from '@/lib/session';
import { ActivitiesManager } from './_components/ActivitiesManager';

export default async function ActivitiesPage() {
  await requireProfile();
  const db = await createClient();

  const courses = await createCoursesService(db).list();
  const initialRules = courses[0]
    ? await createActivityTypesService(db).listByCourse(courses[0].id)
    : [];

  return <ActivitiesManager courses={courses} initialCourseId={courses[0]?.id ?? null} initialRules={initialRules} />;
}
