import React, { useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Clock, LogOut, Send, Loader2, Sparkles, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { HIILogo } from './HIILogo';

export const AuthWall: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    currentUser,
    authLoading,
    userRole,
    isSigningIn,
    signIn,
    signOut,
    requestAccess,
    requestSubmitted,
  } = useAuth();

  const [requestNote, setRequestNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [requestSentNotice, setRequestSentNotice] = useState(false);

  // 1. Initial Authentication Check Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#14171a] flex flex-col items-center justify-center p-4">
        <div className="bg-[#1e2227] border border-[#363c44] rounded-2xl p-8 max-w-md w-full text-center shadow-2xl space-y-4">
          <div className="flex justify-center">
            <HIILogo size="lg" showWordmark variant="dark" className="h-12 w-auto" />
          </div>
          <div className="flex items-center justify-center gap-2 text-sky text-sm font-mono pt-2">
            <Loader2 className="w-5 h-5 animate-spin text-passion" />
            <span>Verifying Security Clearance...</span>
          </div>
          <p className="text-xs text-steel">Connecting to HII Defense Intelligence Identity Provider.</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Gate (Prompt for Google Sign-In)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#14171a] flex flex-col items-center justify-center p-4">
        <div className="bg-[#1e2227] border border-[#363c44] rounded-2xl p-8 max-w-lg w-full text-center shadow-2xl relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-deepsea via-sky to-passion" />

          <div className="flex justify-center mb-6">
            <HIILogo size="lg" showWordmark variant="dark" className="h-14 w-auto" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-charcoal border border-steel/60 text-xs font-mono text-sky mb-4">
            <Shield className="w-3.5 h-3.5 text-passion" />
            <span>NYSE: HII · SECURE INTELLIGENCE CONTROL</span>
          </div>

          <h1 className="text-xl font-bold text-white tracking-wide mb-2">
            HII Multi-Audience Sentiment Intelligence
          </h1>

          <p className="text-xs text-sky/85 leading-relaxed mb-6 max-w-md mx-auto">
            Longitudinal defense stakeholder intelligence (Executive Branch, Congress, Dept of the Navy, American Public) and 6-month deterministic forecasting. Access is restricted to authorized executive analysts and defense sponsors.
          </p>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={signIn}
              disabled={isSigningIn}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-[#1e2227] font-semibold text-sm transition shadow-lg disabled:opacity-60"
            >
              {isSigningIn ? (
                <Loader2 className="w-5 h-5 animate-spin text-passion" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>{isSigningIn ? 'Connecting with Google...' : 'Sign In with Google Account'}</span>
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-[#363c44] text-[11px] text-steel">
            System: <span className="font-mono text-white/90">Restricted Defense Intelligence Network</span>
          </div>
        </div>
      </div>
    );
  }

  // 3. User is signed in, but Denied or Pending Access
  if (userRole === 'denied' || userRole === 'pending') {
    const isPending = userRole === 'pending' || requestSubmitted || requestSentNotice;

    const handleSendRequest = async () => {
      try {
        setSubmittingNote(true);
        await requestAccess(requestNote);
        setRequestSentNotice(true);
      } catch (err) {
        alert('Failed to submit access request. Please try again.');
      } finally {
        setSubmittingNote(false);
      }
    };

    return (
      <div className="min-h-screen bg-[#14171a] flex flex-col items-center justify-center p-4">
        <div className="bg-[#1e2227] border border-[#363c44] rounded-2xl p-8 max-w-md w-full shadow-2xl relative">
          <div className="flex justify-center mb-5">
            <HIILogo size="md" showWordmark variant="dark" className="h-10 w-auto" />
          </div>

          {/* User Profile Pill */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#16191d] border border-[#2d333b] mb-5">
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName || 'User'}
                className="w-10 h-10 rounded-full border border-steel/60 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-deepsea border border-steel flex items-center justify-center text-sm font-bold text-white shrink-0">
                {(currentUser.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-white text-xs block truncate">
                {currentUser.displayName || 'Authorized Google Identity'}
              </span>
              <span className="font-mono text-[11px] text-sky block truncate">
                {currentUser.email}
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold shrink-0 border ${
                isPending
                  ? 'bg-amber-950/40 text-amber-300 border-amber-700/60'
                  : 'bg-rose-950/40 text-rose-300 border-rose-700/60'
              }`}
            >
              {isPending ? 'Pending' : 'Restricted'}
            </span>
          </div>

          {isPending ? (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>

              <div>
                <h2 className="text-base font-bold text-white">Access Clearance Request Submitted</h2>
                <p className="text-xs text-sky/85 mt-1 leading-relaxed">
                  Your request has been delivered to the System Administrator. Once approved, your account will instantly gain full intelligence viewer access.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#14171a] border border-[#2d333b] text-left text-xs space-y-1">
                <span className="text-[11px] font-mono text-steel block">Status: Awaiting Review</span>
                <span className="text-white block">You can safely leave this tab open or return later; your role updates in real-time without needing to re-login.</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-passion shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-bold text-white">Clearance Required</h2>
                  <p className="text-xs text-sky/85 mt-0.5">
                    Your Google account does not currently have clearance to access this platform. You may request clearance below.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-medium text-steel block">
                  Affiliation or Access Justification (Optional):
                </label>
                <textarea
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  placeholder="e.g. Defense strategy research, executive brief review..."
                  rows={3}
                  className="w-full text-xs rounded-lg bg-[#14171a] border border-steel/60 p-2.5 text-white placeholder-steel/60 focus:outline-none focus:border-passion resize-none"
                />

                <button
                  type="button"
                  onClick={handleSendRequest}
                  disabled={submittingNote}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-passion hover:bg-passion/90 text-white font-bold text-xs transition shadow-md disabled:opacity-60"
                >
                  {submittingNote ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{submittingNote ? 'Submitting...' : 'Request Clearance from System Administrator'}</span>
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-[#363c44] flex items-center justify-between">
            <span className="text-[11px] text-steel">Not your account?</span>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 text-xs text-sky hover:text-white font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authenticated & Approved (Admin or Viewer)
  return <>{children}</>;
};

export default AuthWall;
