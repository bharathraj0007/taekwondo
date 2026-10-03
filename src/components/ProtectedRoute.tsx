import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Swords } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-600">
        <Swords className="w-12 h-12 text-rose-500 animate-spin mb-4" />
        <p className="text-sm font-medium tracking-wide">Securing your session...</p>
      </div>
    );
  }

  if (!user) {
    // Save current location so we can redirect them back after they sign in
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
