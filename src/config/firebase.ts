import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  Auth,
  User,
  Unsubscribe,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  serverTimestamp,
  Firestore,
  DocumentData,
  Timestamp,
} from 'firebase/firestore';

// -----------------------------------------------------------------------------
// 1. Firebase Initialization & Offline Persistence
// -----------------------------------------------------------------------------

const firebaseConfig = {
  projectId: 'gen-lang-client-0353543048',
  authDomain: 'gen-lang-client-0353543048.firebaseapp.com',
  apiKey: 'AIzaSyCKQ3QI5LI9e7bGqqO4zR289EfAUiEMVrE',
  storageBucket: 'gen-lang-client-0353543048.firebasestorage.app',
  messagingSenderId: '791977684035',
  appId: '1:791977684035:web:9af5af6622f51aaea678f6',
};

export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);

export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// -----------------------------------------------------------------------------
// 2. Admin Accounts
// -----------------------------------------------------------------------------

export const ADMIN_EMAILS: readonly string[] = [
  'hayesorhaze@gmail.com',
];

export function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

// -----------------------------------------------------------------------------
// 3. User Roles & Interfaces
// -----------------------------------------------------------------------------

export type UserRole = 'admin' | 'viewer' | 'pending' | 'denied';

export interface UserRecord {
  email: string;
  role: 'admin' | 'viewer';
  displayName: string;
  approvedAt: Timestamp | ReturnType<typeof serverTimestamp>;
  approvedBy: string;
}

export interface AccessRequestRecord {
  email: string;
  displayName: string;
  requestedAt: Timestamp | ReturnType<typeof serverTimestamp>;
  status: 'pending' | 'approved' | 'rejected';
  note?: string;
}

// -----------------------------------------------------------------------------
// 4. Firestore Collections Setup
// -----------------------------------------------------------------------------

export const USERS_COLLECTION = 'hii_sentiment_users';
export const ACCESS_REQUESTS_COLLECTION = 'hii_sentiment_access_requests';

// -----------------------------------------------------------------------------
// 5. Auth & Access Functions
// -----------------------------------------------------------------------------

export async function signInWithGoogle(): Promise<void> {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error: unknown) {
    const firebaseError = error as { code?: string };
    if (
      firebaseError.code === 'auth/popup-blocked' ||
      firebaseError.code === 'auth/cancelled-popup-request' ||
      firebaseError.code === 'auth/popup-closed-by-user'
    ) {
      await signInWithRedirect(auth, googleProvider);
    } else {
      throw error;
    }
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function watchAuth(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export async function checkUserRole(email: string): Promise<UserRole> {
  const normalizedEmail = email.trim().toLowerCase();

  if (isAdmin(normalizedEmail)) {
    return 'admin';
  }

  const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);
  const userSnapshot = await getDoc(userDocRef);

  if (userSnapshot.exists()) {
    const data = userSnapshot.data() as UserRecord;
    return data.role;
  }

  const reqDocRef = doc(db, ACCESS_REQUESTS_COLLECTION, normalizedEmail);
  const reqSnapshot = await getDoc(reqDocRef);

  if (reqSnapshot.exists()) {
    const reqData = reqSnapshot.data() as AccessRequestRecord;
    if (reqData.status === 'pending') return 'pending';
    if (reqData.status === 'rejected') return 'denied';
  }

  return 'denied';
}

export async function submitAccessRequest(
  email: string,
  displayName: string,
  note: string = ''
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const reqDocRef = doc(db, ACCESS_REQUESTS_COLLECTION, normalizedEmail);

  await setDoc(reqDocRef, {
    email: normalizedEmail,
    displayName,
    requestedAt: serverTimestamp(),
    status: 'pending',
    note,
  } satisfies AccessRequestRecord);
}

export function subscribeToUserRole(
  email: string,
  callback: (role: UserRole) => void
): Unsubscribe {
  const normalizedEmail = email.trim().toLowerCase();

  if (isAdmin(normalizedEmail)) {
    callback('admin');
    return () => {};
  }

  const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);
  const reqDocRef = doc(db, ACCESS_REQUESTS_COLLECTION, normalizedEmail);

  let unsubscribeRequest: Unsubscribe | null = null;

  const unsubscribeUser = onSnapshot(userDocRef, (userSnapshot) => {
    if (userSnapshot.exists()) {
      if (unsubscribeRequest) {
        unsubscribeRequest();
        unsubscribeRequest = null;
      }
      const data = userSnapshot.data() as UserRecord;
      callback(data.role);
    } else {
      if (!unsubscribeRequest) {
        unsubscribeRequest = onSnapshot(reqDocRef, (reqSnapshot) => {
          if (reqSnapshot.exists()) {
            const reqData = reqSnapshot.data() as AccessRequestRecord;
            if (reqData.status === 'pending') {
              callback('pending');
            } else {
              callback('denied');
            }
          } else {
            callback('denied');
          }
        });
      }
    }
  });

  return () => {
    unsubscribeUser();
    if (unsubscribeRequest) {
      unsubscribeRequest();
    }
  };
}

export function subscribeToPendingRequests(
  callback: (requests: (AccessRequestRecord & { id: string })[]) => void
): Unsubscribe {
  const q = query(
    collection(db, ACCESS_REQUESTS_COLLECTION),
    where('status', '==', 'pending')
  );

  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as AccessRequestRecord),
    }));
    callback(requests);
  });
}

export function subscribeToApprovedUsers(
  callback: (users: (UserRecord & { id: string })[]) => void
): Unsubscribe {
  const q = query(collection(db, USERS_COLLECTION));

  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as UserRecord),
    }));
    callback(users);
  });
}

export async function approveAccessRequest(
  targetEmail: string,
  approvedBy: string
): Promise<void> {
  const normalizedEmail = targetEmail.trim().toLowerCase();
  const reqDocRef = doc(db, ACCESS_REQUESTS_COLLECTION, normalizedEmail);
  const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);

  const reqSnapshot = await getDoc(reqDocRef);
  const displayName = reqSnapshot.exists()
    ? (reqSnapshot.data() as AccessRequestRecord).displayName || ''
    : '';

  await setDoc(userDocRef, {
    email: normalizedEmail,
    role: 'viewer',
    displayName,
    approvedAt: serverTimestamp(),
    approvedBy: approvedBy.trim().toLowerCase(),
  } satisfies UserRecord);

  if (reqSnapshot.exists()) {
    await updateDoc(reqDocRef, {
      status: 'approved',
    });
  }
}

export async function revokeUserAccess(targetEmail: string): Promise<void> {
  const normalizedEmail = targetEmail.trim().toLowerCase();
  const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);
  const reqDocRef = doc(db, ACCESS_REQUESTS_COLLECTION, normalizedEmail);

  await deleteDoc(userDocRef);

  const reqSnapshot = await getDoc(reqDocRef);
  if (reqSnapshot.exists()) {
    await updateDoc(reqDocRef, {
      status: 'rejected',
    });
  }
}

export async function directAddViewer(
  targetEmail: string,
  addedBy: string
): Promise<void> {
  const normalizedEmail = targetEmail.trim().toLowerCase();
  const userDocRef = doc(db, USERS_COLLECTION, normalizedEmail);

  await setDoc(userDocRef, {
    email: normalizedEmail,
    role: 'viewer',
    displayName: normalizedEmail.split('@')[0],
    approvedAt: serverTimestamp(),
    approvedBy: addedBy.trim().toLowerCase(),
  } satisfies UserRecord);
}