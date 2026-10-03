import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { trackEngagement } from '../utils/analytics';
import { Swords, Eye, EyeOff, ShieldAlert, Lock, Mail, Phone, User as UserIcon } from 'lucide-react';

export const Auth: React.FC = () => {
  const { login, signup, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Signup flow steps: 'email' | 'otp' | 'details'
  const [signupStep, setSignupStep] = useState<'email' | 'otp' | 'details'>('email');
  const [otp, setOtp] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loginRole, setLoginRole] = useState<'player' | 'referee' | 'admin'>('player');

  useEffect(() => {
    trackEngagement('page_view_auth', '/auth');
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const mode = searchParams.get('mode');
    if (mode === 'signup') {
      setIsLogin(false);
    } else if (mode === 'login') {
      setIsLogin(true);
    }
  }, [location.search]);

  // Handles traditional sign-in
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      setSuccess('Signed in successfully! Redirecting...');
      trackEngagement('user_login_success', '/auth');
      setTimeout(() => {
        const userRole = data.user?.role;
        if (userRole === 'referee') {
          window.location.href = '/referee/dashboard';
        } else if (userRole === 'admin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/';
        }
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Send verification OTP to the entered email
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      setSuccess('A 6-digit verification code has been sent to your email.');
      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
      }
      if (data.otpCode) {
        setDevOtpCode(data.otpCode);
      } else {
        setDevOtpCode(null);
      }
      setSignupStep('otp');
    } catch (err: any) {
      setError(err.message || 'An error occurred while sending the code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify the 6-digit OTP code with backend
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Verification code is invalid or expired.');
      }

      setSuccess('Your email was successfully verified! Now, complete your profile details.');
      setSignupStep('details');
    } catch (err: any) {
      setError(err.message || 'An error occurred during verification.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Complete profile and create player account
  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const finalName = email.split('@')[0];
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: finalName, email, phone: '', password, role: 'player' })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign up');
      }

      setSuccess('Account created successfully! Please sign in with your credentials to proceed.');
      trackEngagement('user_signup_success', '/auth', null);

      // Reset states and flip screen back to login
      setTimeout(() => {
        setIsLogin(true);
        setSignupStep('email');
        setOtp('');
        setPreviewUrl(null);
        setSuccess(null);
        setPassword('');
      }, 2200);
    } catch (err: any) {
      setError(err.message || 'An error occurred during account creation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center border border-red-200">
            <Swords className="w-6 h-6 text-red-600" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-extrabold text-slate-900 tracking-tight">
          {isLogin ? 'Sign in to your account' : 'Create competitor account'}
        </h2>
        <p className="mt-2 text-center text-xs text-slate-400">
          Or{' '}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setSignupStep('email');
              setOtp('');
              setPreviewUrl(null);
              setError(null);
              setSuccess(null);
            }}
            className="font-semibold text-red-600 hover:text-red-500 hover:underline cursor-pointer"
          >
            {isLogin ? 'create a new player/admin profile' : 'sign in with existing details'}
          </button>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl border border-slate-100">
          
          {/* Step Progress Bar for Signup */}
          {!isLogin && (
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-2">
                <span className={signupStep === 'email' ? 'text-red-600' : 'text-slate-400'}>1. Email</span>
                <span className={signupStep === 'otp' ? 'text-red-600' : 'text-slate-400'}>2. Verify</span>
                <span className={signupStep === 'details' ? 'text-red-600' : 'text-slate-400'}>3. Details</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-600 transition-all duration-350"
                  style={{
                    width: signupStep === 'email' ? '33.33%' : signupStep === 'otp' ? '66.66%' : '100%'
                  }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold p-3.5 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-semibold p-3.5 rounded-lg">
              {success}
            </div>
          )}

          {/* Conditional Form Render based on Login or Signup Step */}
          {isLogin ? (
            /* Traditional Sign In Form */
            <form className="space-y-4" onSubmit={handleLoginSubmit}>
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  1. Email address
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="block w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  2. Password
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-10 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-slate-50/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors cursor-pointer disabled:opacity-55"
                >
                  {loading ? 'Authenticating...' : 'Sign In'}
                </button>
              </div>
            </form>
          ) : (
            /* Signup Forms */
            <>
              {signupStep === 'email' && (
                /* STEP 1: Enter Email Only */
                <form className="space-y-4" onSubmit={handleSendOTP}>
                  <div>
                    <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Your Email Address
                    </label>
                    <p className="text-slate-400 text-[11px] mb-2">We will send a 6-digit verification OTP to confirm ownership of this email before registration.</p>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="yourname@domain.com"
                        className="block w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-slate-50/50"
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors cursor-pointer disabled:opacity-55"
                    >
                      {loading ? 'Sending Code...' : 'Send Verification Code'}
                    </button>
                  </div>
                </form>
              )}

              {signupStep === 'otp' && (
                /* STEP 2: Enter OTP Code */
                <form className="space-y-4" onSubmit={handleVerifyOTP}>
                  <div>
                    <label htmlFor="otp" className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Verification Code
                    </label>
                    <p className="text-slate-400 text-[11px] mb-2">Please enter the 6-digit code we sent to <strong className="text-slate-700">{email}</strong></p>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        id="otp"
                        name="otp"
                        type="text"
                        required
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="123456"
                        className="block w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-slate-50/50 tracking-[0.3em] font-mono text-center font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setSignupStep('email');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-slate-500 hover:text-slate-800 underline cursor-pointer"
                    >
                      Change email address
                    </button>
                    <button
                      type="button"
                      onClick={handleSendOTP}
                      className="text-red-600 hover:text-red-800 font-semibold cursor-pointer"
                    >
                      Resend code
                    </button>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors cursor-pointer disabled:opacity-55"
                    >
                      {loading ? 'Verifying...' : 'Verify & Continue'}
                    </button>
                  </div>

                   {/* Sandbox Dev Mailer Link */}
                   {previewUrl && (
                     <div className="mt-4 p-3 bg-red-50/50 border border-red-100 rounded-xl text-xs text-slate-600">
                       <p className="font-bold text-red-700 mb-1">🧪 Test Mode (Nodemailer Sandbox):</p>
                       <p className="mb-2">Your applet is running in testing mode with an Ethereal SMTP server. You can instantly view the code here or open the test inbox:</p>
                       
                       {devOtpCode && (
                         <div className="mb-3 p-3 bg-white rounded-lg border border-red-200 text-center shadow-xs">
                           <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Your Verification OTP Code</span>
                           <span className="text-2xl font-extrabold text-red-600 tracking-widest font-mono">{devOtpCode}</span>
                         </div>
                       )}

                       <a 
                         href={previewUrl} 
                         target="_blank" 
                         rel="noopener noreferrer" 
                         className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition shadow-sm"
                       >
                         Open Test Mailbox
                       </a>
                     </div>
                   )}
                </form>
              )}

              {signupStep === 'details' && (
                /* STEP 3: Complete profile information */
                <form className="space-y-4" onSubmit={handleRegisterUser}>
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-bold text-emerald-800">Email Verified & Secured</span>
                  </div>

                  <div>
                    <label htmlFor="verified-email" className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Your Registered Email
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        id="verified-email"
                        type="email"
                        disabled
                        value={email}
                        className="block w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed select-none font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Set Your Password
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="block w-full pl-10 pr-10 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-slate-50/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-slate-500 text-center">
                    <p className="text-xs font-semibold">Creating account as a <span className="text-red-600 font-extrabold uppercase">Registered Athlete Player</span></p>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors cursor-pointer disabled:opacity-55"
                    >
                      {loading ? 'Creating Account...' : 'Complete Registration'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
};
