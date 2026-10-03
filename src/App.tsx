import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RefereeProtectedRoute } from './components/RefereeProtectedRoute';

// Keep critical entry page synchronous for instant First Contentful Paint
import { Home } from './pages/Home';

// Lazy-load secondary and heavy administrative / referee routes
const SignIn = lazy(() => import('./pages/SignIn').then(m => ({ default: m.SignIn })));
const SignUp = lazy(() => import('./pages/SignUp').then(m => ({ default: m.SignUp })));
const Events = lazy(() => import('./pages/Events').then(m => ({ default: m.Events })));
const Draws = lazy(() => import('./pages/Draws').then(m => ({ default: m.Draws })));
const Register = lazy(() => import('./pages/Register').then(m => ({ default: m.Register })));
const LiveScores = lazy(() => import('./pages/LiveScores').then(m => ({ default: m.LiveScores })));
const Gallery = lazy(() => import('./pages/Gallery').then(m => ({ default: m.Gallery })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const AdminStatus = lazy(() => import('./pages/AdminStatus').then(m => ({ default: m.AdminStatus })));
const Auth = lazy(() => import('./pages/Auth').then(m => ({ default: m.Auth })));
const Scorepad = lazy(() => import('./pages/Scorepad').then(m => ({ default: m.Scorepad })));

// Dedicated Referee Pages
const RefereeLogin = lazy(() => import('./pages/RefereeLogin').then(m => ({ default: m.RefereeLogin })));
const RefereeDashboard = lazy(() => import('./pages/RefereeDashboard').then(m => ({ default: m.RefereeDashboard })));
const RefereeScorepad = lazy(() => import('./pages/RefereeScorepad').then(m => ({ default: m.RefereeScorepad })));

const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[60vh] w-full" role="status" aria-label="Loading page">
    <div className="w-8 h-8 rounded-full border-2 border-[#2b2721]/20 border-t-red-600 animate-spin" />
  </div>
);

function AppLayout() {
  const location = useLocation();
  const isRefereePortal = location.pathname.startsWith('/referee');

  // Dynamic Browser Tab Title Management
  useEffect(() => {
    const path = location.pathname;
    let pageTitle = 'CombatFlow';

    if (path === '/') {
      pageTitle = 'CombatFlow';
    } else if (path === '/events') {
      pageTitle = 'Events | CombatFlow';
    } else if (path === '/draws') {
      pageTitle = 'Brackets & Draws | CombatFlow';
    } else if (path === '/live') {
      pageTitle = 'Live Scores | CombatFlow';
    } else if (path === '/gallery') {
      pageTitle = 'Photo Gallery | CombatFlow';
    } else if (path === '/register' || path.includes('/register')) {
      pageTitle = 'Athlete Registration | CombatFlow';
    } else if (path === '/signin') {
      pageTitle = 'Sign In | CombatFlow';
    } else if (path === '/signup') {
      pageTitle = 'Sign Up | CombatFlow';
    } else if (path === '/profile') {
      pageTitle = 'Athlete Profile | CombatFlow';
    } else if (path === '/admin') {
      pageTitle = 'Admin Dashboard | CombatFlow';
    } else if (path === '/admin/status') {
      pageTitle = 'System Health Status | CombatFlow';
    } else if (path === '/scorepad') {
      pageTitle = 'Combat Scorer | CombatFlow';
    } else if (path === '/referee/login') {
      pageTitle = 'Referee Login | CombatFlow';
    } else if (path === '/referee/dashboard') {
      pageTitle = 'Officiating Desk | CombatFlow';
    } else if (path.startsWith('/referee/match/')) {
      pageTitle = 'Referee Scorepad | CombatFlow';
    } else {
      pageTitle = 'CombatFlow';
    }

    document.title = pageTitle;
  }, [location.pathname]);

  return (
    <div className={`flex flex-col min-h-screen ${isRefereePortal ? 'bg-slate-950' : 'bg-[#ece7dc] font-sans antialiased text-[#2b2721]'}`}>
      {/* Show player Navbar only when not in dedicated referee portal */}
      {!isRefereePortal && <Navbar />}

      {/* Main layout container */}
      <main className="flex-grow flex flex-col">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Player / Visitor Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/events" element={<Events />} />
            <Route path="/draws" element={<Draws />} />
            <Route path="/live" element={<LiveScores />} />
            <Route path="/gallery" element={<Gallery />} />
            
            {/* Legacy fallback route */}
            <Route path="/auth" element={<Auth />} />

            {/* Dedicated Referee Portal Routes */}
            <Route path="/referee/login" element={<Navigate to="/signin" replace />} />
            <Route 
              path="/referee/dashboard" 
              element={
                <RefereeProtectedRoute>
                  <RefereeDashboard />
                </RefereeProtectedRoute>
              } 
            />
            <Route 
              path="/referee/match/:matchId" 
              element={
                <RefereeProtectedRoute>
                  <RefereeScorepad />
                </RefereeProtectedRoute>
              } 
            />

            {/* Protected Player & Admin Routes */}
            <Route 
              path="/scorepad" 
              element={
                <ProtectedRoute>
                  <Scorepad />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/events/:eventId/register" 
              element={
                <ProtectedRoute>
                  <Register />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/register" 
              element={
                <ProtectedRoute>
                  <Register />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/status" 
              element={
                <ProtectedRoute>
                  <AdminStatus />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
            
            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {/* Show site footer only when not in dedicated referee portal */}
      {!isRefereePortal && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppLayout />
      </Router>
    </AuthProvider>
  );
}
