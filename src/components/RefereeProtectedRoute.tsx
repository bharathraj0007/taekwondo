import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RefreshCw } from 'lucide-react';

interface RefereeProtectedRouteProps {
  children: React.ReactNode;
}

export const RefereeProtectedRoute: React.FC<RefereeProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <RefreshCw className="w-8 h-8 text-red-500 animate-spin mb-3" />
        <p className="text-xs font-mono tracking-wider text-slate-400 uppercase font-bold">
          Authenticating Referee Official Session...
        </p>
      </div>
    );
  }

  // Not logged in -> Redirect to unified sign-in
  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  // Logged in but is a player -> Redirect away from referee portal
  if (user.role === 'player') {
    return <Navigate to="/" replace />;
  }

  // Allowed for referee or admin
  return <>{children}</>;
};
