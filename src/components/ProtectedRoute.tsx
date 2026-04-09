import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  role: 'visitor' | 'admin' | 'paramedic';
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const loggedInUser = localStorage.getItem('loggedInUser');
  const userRole = localStorage.getItem('userRole');

  if (role === 'visitor') {
    if (!loggedInUser) {
      return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
  }

  if (role === 'admin') {
    if (userRole !== 'admin') {
      return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
  }

  if (role === 'paramedic') {
    if (userRole !== 'paramedic') {
      return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
  }

  return <Navigate to="/login" replace />;
}
