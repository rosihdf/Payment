import { Navigate, useLocation } from 'react-router-dom';

interface PreserveSearchRedirectProps {
  to: string;
}

/** Redirect that keeps query string and hash. */
export function PreserveSearchRedirect({ to }: PreserveSearchRedirectProps) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
}
