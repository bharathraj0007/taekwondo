import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, ArrowRight, User, LogOut, ShieldCheck } from 'lucide-react';
import { trackEngagement } from '../utils/analytics';

export const Navbar: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    trackEngagement('user_logout', location.pathname, user?._id);
    logout();
    navigate('/');
    setIsOpen(false);
  };

  const handleNavAnchor = (hash: string) => {
    setIsOpen(false);
    if (location.pathname === '/') {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        window.history.replaceState(null, '', `/#${hash}`);
        return;
      }
    }
    navigate(`/#${hash}`);
  };

  const navLinkClass = (path: string) => {
    const isActive = location.pathname === path;
    return `text-xs sm:text-sm font-mono font-bold uppercase tracking-widest transition-all py-1 ${
      isActive 
        ? 'text-red-600 border-b-2 border-red-600' 
        : 'text-[#1e293b]/85 hover:text-red-600'
    }`;
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-[#f4efe4]/92 backdrop-blur-md border-b border-[#2b2721]/15 transition-all">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          
          {/* Logo & Mobile Menu Toggle */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-1.5 text-[#2b2721] hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/20 rounded-lg shrink-0"
              aria-label="Toggle navigation menu"
            >
              {isOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>

            <Link 
              to="/" 
              className="flex items-center gap-2 group shrink-0 min-w-0"
              onClick={() => { setIsOpen(false); trackEngagement('click_logo', location.pathname, user?._id); }}
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform shrink-0">
                <span className="font-mono font-black text-xs sm:text-sm tracking-tighter">CF</span>
              </div>
              <span className="text-lg sm:text-xl font-black tracking-tight text-[#1e293b] font-serif truncate">
                Combat<span className="text-red-600">Flow</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation (>= 768px) */}
          <nav className="hidden md:flex items-center gap-4 lg:gap-6 xl:gap-8 whitespace-nowrap">
            <button 
              onClick={() => handleNavAnchor('hero')} 
              className="text-[10px] lg:text-xs xl:text-sm font-mono font-bold uppercase tracking-widest text-[#1e293b]/85 hover:text-red-600 transition-all cursor-pointer"
            >
              Home
            </button>
            <Link to="/events" className={navLinkClass('/events')}>
              Events
            </Link>
            <Link to="/draws" className={navLinkClass('/draws')}>
              Brackets
            </Link>
            <Link to="/live" className={navLinkClass('/live')}>
              Live
            </Link>
            <button 
              onClick={() => handleNavAnchor('pricing')} 
              className="text-[10px] lg:text-xs xl:text-sm font-mono font-bold uppercase tracking-widest text-[#1e293b]/85 hover:text-red-600 transition-all cursor-pointer"
            >
              Pricing
            </button>
            <button 
              onClick={() => handleNavAnchor('contact')} 
              className="text-[10px] lg:text-xs xl:text-sm font-mono font-bold uppercase tracking-widest text-[#1e293b]/85 hover:text-red-600 transition-all cursor-pointer"
            >
              Contact
            </button>
          </nav>

          {/* Right Side: Sign In, Sign Up (Visible on Tablet/Desktop >= 768px; Hidden on Phone < 768px) */}
          <div className="hidden md:flex items-center gap-2.5 sm:gap-3 shrink-0">
            {user ? (
              <div className="flex items-center gap-2">
                {user.role === 'referee' && (
                  <Link
                    to="/referee/dashboard"
                    className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Desk</span>
                  </Link>
                )}
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#2b2721] hover:text-red-600 transition-colors max-w-[140px] truncate"
                >
                  <User className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span className="truncate">{user.name}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-[#2b2721]/70 hover:text-red-600 transition-colors cursor-pointer"
                  title="Log out"
                  aria-label="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link
                  to="/signin"
                  className="inline-flex items-center justify-center px-3.5 py-2 text-xs font-bold text-[#1e293b] bg-[#fcfaf6]/90 hover:bg-white border border-[#2b2721]/25 hover:border-red-600 hover:text-red-600 active:scale-98 rounded-lg shadow-xs transition-all"
                  onClick={() => trackEngagement('click_login_btn', location.pathname)}
                >
                  <span>Sign In</span>
                </Link>

                <Link
                  to="/signup"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-98 rounded-lg shadow-sm transition-all"
                  onClick={() => trackEngagement('click_signup_btn', location.pathname)}
                >
                  <span>Sign Up</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>

        </div>

        {/* Mobile Navigation Drawer (< 768px) */}
        {isOpen && (
          <div className="md:hidden border-t border-[#2b2721]/15 bg-[#f4efe4] px-6 py-6 flex flex-col gap-4 shadow-xl animate-fade-in">
            <button
              onClick={() => handleNavAnchor('hero')}
              className="text-left font-mono text-sm font-bold uppercase tracking-widest text-[#1e293b]/90 hover:text-red-600 py-1 cursor-pointer"
            >
              Home
            </button>
            <Link 
              to="/events" 
              className="font-mono text-sm font-bold uppercase tracking-widest text-[#1e293b]/90 hover:text-red-600 py-1"
              onClick={() => setIsOpen(false)}
            >
              Events
            </Link>
            <Link 
              to="/draws" 
              className="font-mono text-sm font-bold uppercase tracking-widest text-[#1e293b]/90 hover:text-red-600 py-1"
              onClick={() => setIsOpen(false)}
            >
              View Draw / Bracket
            </Link>
            <Link 
              to="/live" 
              className="font-mono text-sm font-bold uppercase tracking-widest text-[#1e293b]/90 hover:text-red-600 py-1"
              onClick={() => setIsOpen(false)}
            >
              Live Scores
            </Link>
            <button 
              onClick={() => handleNavAnchor('pricing')} 
              className="text-left font-mono text-sm font-bold uppercase tracking-widest text-[#1e293b]/90 hover:text-red-600 py-1 cursor-pointer"
            >
              Pricing
            </button>
            <button 
              onClick={() => handleNavAnchor('contact')} 
              className="text-left font-mono text-sm font-bold uppercase tracking-widest text-[#1e293b]/90 hover:text-red-600 py-1 cursor-pointer"
            >
              Contact
            </button>

            {/* Mobile Actions: Sign In / Sign Up or Logged in Profile */}
            <div className="pt-3 border-t border-[#2b2721]/15">
              {user ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between py-1">
                    <Link
                      to="/profile"
                      className="inline-flex items-center gap-2 text-sm font-bold text-[#1e293b] hover:text-red-600 transition-colors"
                      onClick={() => setIsOpen(false)}
                    >
                      <User className="w-4 h-4 text-red-600" />
                      <span>{user.name}</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 py-1 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                  {user.role === 'referee' && (
                    <Link
                      to="/referee/dashboard"
                      className="inline-flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors shadow-2xs"
                      onClick={() => setIsOpen(false)}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Officiating Desk</span>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    to="/signin"
                    className="inline-flex items-center justify-center py-2.5 text-xs font-bold text-[#1e293b] bg-[#fcfaf6] border border-[#2b2721]/25 hover:border-red-600 hover:text-red-600 rounded-lg shadow-2xs transition-all"
                    onClick={() => setIsOpen(false)}
                  >
                    <span>Sign In</span>
                  </Link>

                  <Link
                    to="/signup"
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-all"
                    onClick={() => setIsOpen(false)}
                  >
                    <span>Sign Up</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
};

