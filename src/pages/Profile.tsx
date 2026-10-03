import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { trackEngagement } from '../utils/analytics';
import { User, Phone, Shield, Calendar, Award, Building, Heart, Download, CheckCircle, Save, Key, Trophy, Sparkles, FileText } from 'lucide-react';

interface RegistrationDetails {
  _id: string;
  fullName: string;
  dob: string;
  gender: 'male' | 'female';
  weightCategory: string;
  beltRank: string;
  coachName?: string;
  clubName?: string;
  aadharLastFour?: string;
  emergencyContact?: string;
  photoBase64?: string;
  pdfUrl: string;
  status: string;
  createdAt: string;
}

interface MatchDetails {
  _id: string;
  weightCategory: string;
  gender: 'male' | 'female';
  round: string;
  player1Name: string;
  player2Name: string;
  winnerId: string | null;
  score: {
    player1: number;
    player2: number;
  };
  status: 'pending' | 'live' | 'completed';
}

export const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  
  // Profile edit state
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // App UI states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Registration & match info state
  const [registration, setRegistration] = useState<RegistrationDetails | null>(null);
  const [matches, setMatches] = useState<MatchDetails[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = (regId: string, fullName: string) => {
    trackEngagement('pdf_download_clicked', '/profile', user?._id);
    const link = document.createElement('a');
    link.href = `/api/registrations/download/${regId}`;
    link.download = `CombatFlow_Registration_${regId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    trackEngagement('page_view_profile', '/profile', user?._id);
    fetchUserData();
  }, [user?._id]);

  const fetchUserData = async () => {
    if (!user) return;
    try {
      setLoadingData(true);
      
      // Fetch user's registrations
      const regRes = await fetch('/api/registrations', {
        credentials: 'include'
      });
      
      if (regRes.ok) {
        const regs = await regRes.json();
        // Take the first registration for this user if exists
        if (regs && regs.length > 0) {
          setRegistration(regs[0]);
          
          // Now fetch matches to see if this user is in any match brackets
          const matchRes = await fetch('/api/matches', { credentials: 'include' });
          if (matchRes.ok) {
            const allMatches: MatchDetails[] = await matchRes.json();
            const userMatches = allMatches.filter(m => 
              m.player1Name === regs[0].fullName || 
              m.player2Name === regs[0].fullName
            );
            setMatches(userMatches);
          }

          // Fetch user's certificates
          const certRes = await fetch('/api/certificates/my-certificates', {
            credentials: 'include'
          });
          if (certRes.ok) {
            const certs = await certRes.json();
            setCertificates(certs);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching user context data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (password) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    try {
      setIsLoading(true);
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name,
          phone,
          password: password || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      updateUser(data.user);
      setSuccess('Profile updated successfully!');
      setPassword('');
      setConfirmPassword('');
      trackEngagement('profile_update_success', '/profile', user?._id);
    } catch (err: any) {
      setError(err.message || 'Error occurred while updating profile.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-12 text-center px-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
          <Shield className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-sm text-slate-500 mb-6">Please log in to view your profile dashboard and download registration documents.</p>
          <a href="/auth?mode=login" className="inline-block bg-slate-900 text-white font-bold text-xs px-6 py-2.5 rounded-lg hover:bg-slate-800 transition-colors">
            Sign In Now
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
      {/* Editorial Header */}
      <div className="border-b border-slate-200 pb-6 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">My Profile Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your account settings, view competitor status, and access competition materials.
          </p>
        </div>
        {(user?.role === 'admin' || user?.role === 'referee') && (
          <div className="flex items-center gap-3 shrink-0">
            {user?.role === 'admin' && (
              <Link 
                to="/admin"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm hover:shadow-md transition-all active:scale-98"
              >
                <Shield className="w-4 h-4" />
                <span>Admin Dashboard</span>
              </Link>
            )}
            {user?.role === 'referee' && (
              <Link 
                to="/referee/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm hover:shadow-md transition-all active:scale-98"
              >
                <Shield className="w-4 h-4" />
                <span>Referee Desk</span>
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Hand: Profile Information & Settings */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Personal Account Settings</span>
            </h2>

            {success && (
              <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-medium border border-emerald-100 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-xs font-medium border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 focus:outline-none"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="w-full px-3 py-2 text-sm border border-slate-100 bg-slate-50 text-slate-400 rounded-lg cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400 block mt-1">Email cannot be modified once registered.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 focus:outline-none"
                  placeholder="e.g. +1 (555) 019-2834"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />
                  Change Password
                </span>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 focus:outline-none"
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 focus:outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 transition-colors cursor-pointer disabled:opacity-55 mt-2"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isLoading ? 'Saving Changes...' : 'Save Changes'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Hand: Competitor Entry Verification & Matches */}
        <div className="lg:col-span-2 space-y-6">
          
          {loadingData ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center">
              <span className="text-slate-400 text-sm font-medium">Verifying competition database...</span>
            </div>
          ) : registration ? (
            <div className="space-y-6">
              {/* Competitor Overview Card */}
              <div className="bg-white rounded-2xl border-2 border-slate-900 overflow-hidden shadow-sm">
                <div className="bg-slate-900 text-white p-4 sm:px-6 sm:py-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono tracking-widest text-red-400 block uppercase font-bold">Official Competitor License</span>
                    <h2 className="text-lg font-black uppercase tracking-wide">{registration.fullName}</h2>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-mono">STATUS</span>
                    <span className="text-xs font-bold uppercase text-emerald-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Active Entry
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Competitor Info Row (Photo + Metadata Grid) */}
                  <div className="flex flex-col sm:flex-row gap-6 items-start">
                    {registration.photoBase64 ? (
                      <img 
                        src={registration.photoBase64} 
                        alt="Competitor Photo" 
                        className="w-28 h-32 object-cover rounded-xl border border-slate-200 shadow-sm shrink-0 mx-auto sm:mx-0"
                      />
                    ) : (
                      <div className="w-28 h-32 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 shrink-0 mx-auto sm:mx-0">
                        <User className="w-10 h-10 text-slate-300 mb-1" />
                        <span className="text-[10px] font-medium">No Photo</span>
                      </div>
                    )}
                    
                    <div className="flex-1 w-full min-w-0">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 text-sm">
                        <div>
                          <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Registration ID</span>
                          <span className="inline-block font-mono font-extrabold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded text-xs select-all">
                            {registration._id}
                          </span>
                        </div>

                        <div>
                          <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Date of Birth</span>
                          <span className="font-semibold text-slate-800">{registration.dob || 'Not Provided'}</span>
                        </div>

                        <div>
                          <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Gender</span>
                          <span className="font-semibold text-slate-800 capitalize">{registration.gender}</span>
                        </div>

                        <div>
                          <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Belt Grade</span>
                          <span className="font-semibold text-slate-800 flex items-center gap-1.5 capitalize">
                            <Award className="w-4 h-4 text-amber-500 shrink-0" />
                            {registration.beltRank}
                          </span>
                        </div>

                        <div>
                          <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Weight Class</span>
                          <span className="font-bold text-red-600">{registration.weightCategory}</span>
                        </div>

                        <div>
                          <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Coach / Academy</span>
                          <span className="font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                            <Building className="w-4 h-4 text-slate-400 shrink-0" />
                            {registration.coachName || registration.clubName || 'Not Available'}
                          </span>
                        </div>

                        <div>
                          <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Aadhar (Last 4)</span>
                          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <Heart className="w-4 h-4 text-red-500 shrink-0" />
                            {registration.aadharLastFour || registration.emergencyContact || 'Not Available'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PDF Download Attachment block positioned cleanly below */}
                  <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/60">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-red-600" />
                        Competitor Application Copy
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Required at official physical weigh-ins. Present this slip alongside your uniform (Dobok).
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={downloadingPdf}
                      onClick={() => handleDownloadPdf(registration._id, registration.fullName)}
                      className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm hover:shadow active:scale-98 transition-all whitespace-nowrap cursor-pointer shrink-0"
                    >
                      <Download className="w-4 h-4 animate-bounce" style={{ animationDuration: downloadingPdf ? '1s' : '0s' }} />
                      <span>{downloadingPdf ? 'Downloading...' : 'Download PDF Slip'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Personal Match Bracket Listings */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-red-600" />
                  <span>My Scheduled Tournament Matches</span>
                </h3>

                {matches.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
                    <Sparkles className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs">No active bracket pairings generated yet for your division.</p>
                    <p className="text-[10px] text-slate-400 mt-1">The tournament administrator will build fight pairs once registrations close.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {matches.map((match) => {
                      const isPlayer1 = match.player1Name === registration.fullName;
                      const opponent = isPlayer1 ? match.player2Name : match.player1Name;
                      const myScore = isPlayer1 ? match.score.player1 : match.score.player2;
                      const oppScore = isPlayer1 ? match.score.player2 : match.score.player1;
                      
                      return (
                        <div key={match._id} className="p-4 border border-slate-100 rounded-lg flex items-center justify-between gap-4 hover:border-slate-200 transition-colors bg-slate-50/50">
                          <div>
                            <div className="flex items-center gap-2 text-xs mb-1">
                              <span className="font-bold text-red-600 capitalize">{match.round}</span>
                              <span className="text-slate-300">·</span>
                              <span className="text-slate-500 font-medium">{match.weightCategory} ({match.gender})</span>
                            </div>
                            <p className="text-xs text-slate-600 font-medium">
                              Opponent: <span className="font-bold text-slate-900">{opponent || 'TBD'}</span>
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block mb-0.5">STATUS</span>
                            {match.status === 'live' ? (
                              <span className="inline-flex items-center text-[10px] font-bold text-red-600 uppercase animate-pulse">
                                Live Now · {myScore} - {oppScore}
                              </span>
                            ) : match.status === 'completed' ? (
                              <span className="inline-flex items-center text-[10px] font-bold text-slate-600">
                                Completed ({myScore} - {oppScore})
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] font-bold text-slate-400">
                                Scheduled
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Earned Championship Certificates */}
              {certificates && certificates.length > 0 && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span>My Championship Certificates</span>
                  </h3>

                  <div className="space-y-3">
                    {certificates.map((cert) => (
                      <div 
                        key={cert._id} 
                        className="p-4 border border-amber-100 bg-amber-50/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-amber-500"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 text-xs text-amber-800 font-bold tracking-wider mb-1.5">
                            <span>🏅 {cert.position === '1st' ? 'Gold (1st)' : cert.position === '2nd' ? 'Silver (2nd)' : 'Bronze (3rd)'} Place</span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 capitalize">
                            {cert.ageCategory} {cert.gender === 'male' ? 'Male' : 'Female'} {cert.weightCategory}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Championship Division Standing Certified
                          </p>
                        </div>

                        <a
                          href={cert.certificateUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm transition-colors shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download Certificate</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Not yet registered CTA card */
            <div className="bg-white p-8 rounded-xl border border-slate-200/80 text-center shadow-sm">
              <Sparkles className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">Complete Your Entry Registration</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                You have an active participant account but haven't submitted your athlete details for the upcoming Taekwondo event. Register now to claim your bracket!
              </p>
              <a
                href="/register"
                className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-6 py-3 rounded-lg hover:shadow transition-colors"
              >
                <span>Complete Registration</span>
              </a>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
