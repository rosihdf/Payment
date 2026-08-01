import { Navigate, useLocation } from 'react-router-dom';
import type { AdminCatalogTab } from '../../utils/routes';

interface AdminCatalogRedirectProps {
  tab: AdminCatalogTab;
}

/** Legacy-Admin-Routen auf /admin/catalog umleiten und Query/Hash behalten. */
export function AdminCatalogRedirect({ tab }: AdminCatalogRedirectProps) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set('tab', tab);
  const search = params.toString();
  return <Navigate to={`/admin/catalog${search ? `?${search}` : ''}${location.hash}`} replace />;
}
