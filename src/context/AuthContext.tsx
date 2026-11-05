import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  auth,
  isAdmin,
  signInWithGoogle,
  signOutUser,
  watchAuth,
  subscribeToUserRole,
  subscribeToPendingRequests,
  subscribeToApprovedUsers,
  submitAccessRequest,
  approveAccessRequest,
  revokeUserAccess,
  directAddViewer,
  type UserRole,
  type UserRecord,
  type AccessRequestRecord,
} from '../config/firebase';

export interface AuthContextValue {
  currentUser: User | null;
  authLoading: boolean;
  userRole: UserRole;
  isSigningIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  requestAccess: (note?: string) => Promise<void>;
  requestSubmitted: boolean;
  // Admin only features
  pendingRequests: (AccessRequestRecord & { id: string })[];
  approvedUsers: (UserRecord & { id: string })[];
  approveRequest: (targetEmail: string) => Promise<void>;
  revokeAccess: (targetEmail: string) => Promise<void>;
  directAdd: (targetEmail: string) => Promise<void>;
  showUserModal: boolean;
  setShowUserModal: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [userRole, setUserRole] = useState<UserRole>('denied');
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [requestSubmitted, setRequestSubmitted] = useState<boolean>(false);

  // Admin state
  const [pendingRequests, setPendingRequests] = useState<(AccessRequestRecord & { id: string })[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<(UserRecord & { id: string })[]>([]);
  const [showUserModal, setShowUserModal] = useState<boolean>(false);

  // 1. Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribeAuth = watchAuth((user) => {
      setCurrentUser(user);
      if (!user || !user.email) {
        setUserRole('denied');
        setAuthLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 2. Realtime role sync for active user
  useEffect(() => {
    if (!currentUser || !currentUser.email) {
      setUserRole('denied');
      setAuthLoading(false);
      return;
    }

    const email = currentUser.email.toLowerCase();
    if (isAdmin(email)) {
      setUserRole('admin');
      setAuthLoading(false);
      return;
    }

    // Subscribe to Firestore role / request document
    const unsubscribeRole = subscribeToUserRole(email, (role) => {
      setUserRole(role);
      setAuthLoading(false);
      if (role === 'pending') {
        setRequestSubmitted(true);
      }
    });

    return () => unsubscribeRole();
  }, [currentUser]);

  // 3. For Admins: subscribe to pending requests and approved users
  useEffect(() => {
    if (userRole !== 'admin') {
      setPendingRequests([]);
      setApprovedUsers([]);
      return;
    }

    const unsubPending = subscribeToPendingRequests((requests) => {
      setPendingRequests(requests);
    });

    const unsubUsers = subscribeToApprovedUsers((users) => {
      setApprovedUsers(users);
    });

    return () => {
      unsubPending();
      unsubUsers();
    };
  }, [userRole]);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await signInWithGoogle();
    } catch (err) {
      console.error('[HII Auth] Google Sign-In error:', err);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setCurrentUser(null);
      setUserRole('denied');
      setRequestSubmitted(false);
    } catch (err) {
      console.error('[HII Auth] Sign-out error:', err);
    }
  };

  const handleRequestAccess = async (note: string = '') => {
    if (!currentUser || !currentUser.email) return;
    try {
      await submitAccessRequest(
        currentUser.email,
        currentUser.displayName || currentUser.email.split('@')[0],
        note
      );
      setRequestSubmitted(true);
      setUserRole('pending');
    } catch (err) {
      console.error('[HII Auth] Failed to submit access request:', err);
      throw err;
    }
  };

  const handleApprove = async (targetEmail: string) => {
    if (!currentUser?.email || userRole !== 'admin') return;
    await approveAccessRequest(targetEmail, currentUser.email);
  };

  const handleRevoke = async (targetEmail: string) => {
    if (!currentUser?.email || userRole !== 'admin') return;
    await revokeUserAccess(targetEmail);
  };

  const handleDirectAdd = async (targetEmail: string) => {
    if (!currentUser?.email || userRole !== 'admin') return;
    await directAddViewer(targetEmail, currentUser.email);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        authLoading,
        userRole,
        isSigningIn,
        signIn: handleSignIn,
        signOut: handleSignOut,
        requestAccess: handleRequestAccess,
        requestSubmitted,
        pendingRequests,
        approvedUsers,
        approveRequest: handleApprove,
        revokeAccess: handleRevoke,
        directAdd: handleDirectAdd,
        showUserModal,
        setShowUserModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
