import { Navigate } from 'react-router-dom';

/** Legacy-Route leitet auf die neue Provisionsübersicht um. */
export function AdminCommissionPage() {
  return <Navigate to="/admin/commission/overview" replace />;
}
