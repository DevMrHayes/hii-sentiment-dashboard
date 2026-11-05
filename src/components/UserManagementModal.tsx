import React, { useState } from 'react';
import {
  X,
  UserCheck,
  UserX,
  Clock,
  Shield,
  UserPlus,
  Mail,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const UserManagementModal: React.FC = () => {
  const {
    showUserModal,
    setShowUserModal,
    pendingRequests,
    approvedUsers,
    approveRequest,
    revokeAccess,
    directAdd,
    currentUser,
  } = useAuth();

  const [directEmail, setDirectEmail] = useState('');
  const [directSuccess, setDirectSuccess] = useState(false);
  const [processingEmail, setProcessingEmail] = useState<string | null>(null);

  if (!showUserModal) return null;

  const handleApprove = async (email: string) => {
    try {
      setProcessingEmail(email);
      await approveRequest(email);
    } catch (err) {
      alert('Failed to approve request: ' + (err as Error).message);
    } finally {
      setProcessingEmail(null);
    }
  };

  const handleRevoke = async (email: string) => {
    if (!window.confirm(`Revoke intelligence clearance for ${email}?`)) return;
    try {
      setProcessingEmail(email);
      await revokeAccess(email);
    } catch (err) {
      alert('Failed to revoke access: ' + (err as Error).message);
    } finally {
      setProcessingEmail(null);
    }
  };

  const handleDirectAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directEmail.trim() || !directEmail.includes('@')) return;
    try {
      setProcessingEmail(directEmail);
      await directAdd(directEmail.trim());
      setDirectEmail('');
      setDirectSuccess(true);
      setTimeout(() => setDirectSuccess(false), 2500);
    } catch (err) {
      alert('Failed to grant access: ' + (err as Error).message);
    } finally {
      setProcessingEmail(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#1e2227] border border-[#363c44] rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#363c44] bg-[#16191d]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-passion/20 border border-passion/50 text-passion">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                HII INTELLIGENCE ACCESS CONTROL & CLEARANCES
              </h2>
              <p className="text-[11px] text-sky/80">
                Managed by Admin <span className="font-mono text-white">{currentUser?.email}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowUserModal(false)}
            className="p-1.5 rounded-lg text-steel hover:text-white hover:bg-charcoal transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Quick Grant Input */}
          <div className="p-3.5 rounded-xl bg-[#14171a] border border-[#2d333b]">
            <span className="text-xs font-bold text-white flex items-center gap-1.5 mb-2">
              <UserPlus className="w-3.5 h-3.5 text-sky" />
              <span>Directly Grant Viewer Clearance</span>
            </span>

            <form onSubmit={handleDirectAdd} className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="w-3.5 h-3.5 text-steel absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={directEmail}
                  onChange={(e) => setDirectEmail(e.target.value)}
                  placeholder="analyst@domain.com or google email..."
                  className="w-full text-xs rounded-lg bg-charcoal border border-steel/60 pl-8 pr-3 py-2 text-white placeholder-steel/60 focus:outline-none focus:border-passion"
                />
              </div>
              <button
                type="submit"
                disabled={!directEmail.trim() || processingEmail === directEmail}
                className="px-4 py-2 rounded-lg bg-passion hover:bg-passion/90 text-white font-bold text-xs transition shadow-md disabled:opacity-50 shrink-0"
              >
                {processingEmail === directEmail ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Grant Clearance'
                )}
              </button>
            </form>
            {directSuccess && (
              <span className="text-[11px] font-mono text-emerald-400 mt-2 block">
                ✓ Clearance granted successfully. User can now view the platform.
              </span>
            )}
          </div>

          {/* Pending Access Requests Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Pending Clearance Requests ({pendingRequests.length})</span>
              </span>
              <span className="text-[11px] text-steel">Requires your approval</span>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#16191d] border border-[#2d333b] text-center text-xs text-steel">
                No pending requests. All submitted access requests have been cleared.
              </div>
            ) : (
              <div className="space-y-2">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-xl bg-[#16191d] border border-amber-600/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-xs">{req.displayName}</span>
                        <span className="font-mono text-[11px] text-sky">{req.email}</span>
                      </div>
                      {req.note && (
                        <p className="text-[11px] text-sky/80 italic mt-1 bg-charcoal/60 px-2 py-1 rounded">
                          "{req.note}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        onClick={() => handleApprove(req.email)}
                        disabled={processingEmail === req.email}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-sm"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Approve Viewer</span>
                      </button>
                      <button
                        onClick={() => handleRevoke(req.email)}
                        disabled={processingEmail === req.email}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-charcoal hover:bg-rose-950/50 border border-steel hover:border-rose-600 text-steel hover:text-rose-300 text-xs transition"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Deny</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Approved Users List */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Active Authorized Viewers ({approvedUsers.length})</span>
            </span>

            {approvedUsers.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#16191d] border border-[#2d333b] text-center text-xs text-steel">
                No external viewers authorized yet. Add email addresses above or approve requests.
              </div>
            ) : (
              <div className="divide-y divide-[#2d333b] border border-[#2d333b] rounded-xl overflow-hidden bg-[#16191d]">
                {approvedUsers.map((u) => (
                  <div key={u.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-white block">{u.displayName || u.email}</span>
                      <span className="font-mono text-[11px] text-sky">{u.email}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-deepsea border border-steel/60 text-sky">
                        {u.role} (Read-Only)
                      </span>
                      <button
                        onClick={() => handleRevoke(u.email)}
                        disabled={processingEmail === u.email}
                        className="text-steel hover:text-rose-400 p-1 rounded hover:bg-charcoal transition"
                        title="Revoke Access"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#363c44] bg-[#16191d] text-center text-[11px] text-steel">
          Authorized viewers can inspect all intelligence data, divisions, and forecasts, but cannot trigger agents or alter budgets.
        </div>
      </div>
    </div>
  );
};

export default UserManagementModal;
