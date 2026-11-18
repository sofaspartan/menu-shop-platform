import { Navigate } from 'react-router-dom'

/** Tables merged into Dining — keep this route as a redirect. */
export function TablesPage() {
  return <Navigate to="/dashboard/dining" replace />
}
