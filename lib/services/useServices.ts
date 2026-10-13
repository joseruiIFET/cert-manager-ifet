'use client';

import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createActivityTypesService, createCoursesService } from './activityTypesService';
import { createAuthService } from './authService';
import { createCertificatesService } from './certificatesService';
import { createStorageService } from './storageService';

/** Serviços ligados ao cliente de browser. Um único cliente por componente raiz. */
export function useServices() {
  return useMemo(() => {
    const db = createClient();
    return {
      auth: createAuthService(db),
      certificates: createCertificatesService(db),
      activityTypes: createActivityTypesService(db),
      courses: createCoursesService(db),
      storage: createStorageService(db),
    };
  }, []);
}
