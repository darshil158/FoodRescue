// ============================================================
// FoodRescue — Authentication Module
// ============================================================

import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast } from './notifications.js';

const ROLE_REDIRECTS = {
  restaurant: '/dashboard/restaurant/',
  ngo:        '/dashboard/ngo/',
  volunteer:  '/dashboard/volunteer/',
  admin:      '/dashboard/admin/'
};

// ── Auth State Observer ─────────────────────────────────────
export function initAuthObserver(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : null;
      callback(user, userData);
    } else {
      callback(null, null);
    }
  });
}

// ── Role-based redirect ─────────────────────────────────────
export async function redirectByRole(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const role = snap.data().role;
      const dest = ROLE_REDIRECTS[role] || '/';
      window.location.href = dest;
    }
  } catch (e) {
    console.error('Role redirect error:', e);
  }
}

// ── Email/Password Sign Up ──────────────────────────────────
export async function signUpWithEmail({ email, password, name, phone, role, extraData }) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;
    await updateProfile(cred.user, { displayName: name });

    // Base user document
    const userPayload = {
      uid, email, name, phone, role,
      avatar: '',
      verified: false,
      verificationStatus: 'pending',
      createdAt: serverTimestamp(),
      location: {},
      fcmToken: ''
    };
    await setDoc(doc(db, 'users', uid), userPayload);

    // Role-specific collection
    if (role === 'restaurant') {
      await setDoc(doc(db, 'restaurants', uid), {
        businessName: extraData.businessName || '',
        fssaiNumber:  extraData.fssaiNumber  || '',
        businessType: extraData.businessType || '',
        totalDonations: 0, totalMealsSaved: 0, impactScore: 0,
        certifiedDonor: false, documents: {}
      });
    } else if (role === 'ngo') {
      await setDoc(doc(db, 'ngos', uid), {
        orgName: extraData.orgName || '',
        regNumber: extraData.regNumber || '',
        panNumber: extraData.panNumber || '',
        trust12A: extraData.trust12A || '',
        capacity: 0, serviceArea: [],
        activeVolunteers: 0, totalReceived: 0,
        avgResponseTime: 0, reliabilityScore: 100,
        documents: {}
      });
    } else if (role === 'volunteer') {
      await setDoc(doc(db, 'volunteers', uid), {
        govtIdType: extraData.govtIdType || '',
        vehicleType: extraData.vehicleType || '',
        vehicleNumber: '',
        available: false, totalDeliveries: 0,
        rating: 5.0, rewardPoints: 0,
        tier: 'seedling', consecutiveRejections: 0,
        documents: {}
      });
    }

    showToast('Account Created', `Welcome to FoodRescue, ${name}!`, 'success');
    await redirectByRole(uid);
    return { success: true, uid };
  } catch (err) {
    showToast('Sign Up Failed', getAuthError(err.code), 'error');
    return { success: false, error: err.code };
  }
}

// ── Email/Password Login ────────────────────────────────────
export async function loginWithEmail(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await redirectByRole(cred.user.uid);
    return { success: true };
  } catch (err) {
    showToast('Login Failed', getAuthError(err.code), 'error');
    return { success: false, error: err.code };
  }
}

// ── Google OAuth ────────────────────────────────────────────
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const uid = result.user.uid;
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) {
      // New Google user — redirect to role selection
      window.location.href = `/signup.html?google=1&uid=${uid}&email=${encodeURIComponent(result.user.email)}&name=${encodeURIComponent(result.user.displayName)}`;
    } else {
      await redirectByRole(uid);
    }
    return { success: true };
  } catch (err) {
    showToast('Google Login Failed', getAuthError(err.code), 'error');
    return { success: false, error: err.code };
  }
}

// ── Phone OTP ───────────────────────────────────────────────
let confirmationResult = null;

export function setupRecaptcha(containerId) {
  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {}
  });
}

export async function sendPhoneOTP(phoneNumber) {
  try {
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
    confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
    showToast('OTP Sent', `Verification code sent to ${formattedPhone}`, 'success');
    return { success: true };
  } catch (err) {
    showToast('OTP Failed', getAuthError(err.code), 'error');
    return { success: false, error: err.code };
  }
}

export async function verifyPhoneOTP(otp) {
  try {
    if (!confirmationResult) throw new Error('No OTP request pending');
    const cred = await confirmationResult.confirm(otp);
    const uid = cred.user.uid;
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) {
      window.location.href = `/signup.html?phone=1&uid=${uid}`;
    } else {
      await redirectByRole(uid);
    }
    return { success: true };
  } catch (err) {
    showToast('Verification Failed', 'Invalid OTP. Please try again.', 'error');
    return { success: false, error: err.code };
  }
}

// ── Password Reset ──────────────────────────────────────────
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('Email Sent', 'Check your inbox for password reset instructions.', 'success');
    return { success: true };
  } catch (err) {
    showToast('Reset Failed', getAuthError(err.code), 'error');
    return { success: false };
  }
}

// ── Logout ──────────────────────────────────────────────────
export async function logout() {
  await signOut(auth);
  window.location.href = '/login.html';
}

// ── Get current user + role ─────────────────────────────────
export async function getCurrentUserData() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? { uid: user.uid, ...snap.data() } : null;
}

// ── Error messages ──────────────────────────────────────────
function getAuthError(code) {
  const messages = {
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/weak-password':         'Password must be at least 6 characters.',
    'auth/user-not-found':        'No account found with this email.',
    'auth/wrong-password':        'Incorrect password.',
    'auth/invalid-email':         'Please enter a valid email address.',
    'auth/too-many-requests':     'Too many attempts. Please try again later.',
    'auth/network-request-failed':'Network error. Check your connection.',
    'auth/popup-closed-by-user':  'Google sign-in was cancelled.',
    'auth/invalid-verification-code': 'Invalid OTP. Please check and retry.'
  };
  return messages[code] || 'An error occurred. Please try again.';
}

// ── Guard: require auth ─────────────────────────────────────
export function requireAuth(redirectTo = '/login.html') {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (!user) {
        window.location.href = redirectTo;
      } else {
        resolve(user);
      }
    });
  });
}

// ── Guard: require role ─────────────────────────────────────
export async function requireRole(expectedRole) {
  const user = await requireAuth();
  const snap = await getDoc(doc(db, 'users', user.uid));
  if (!snap.exists() || snap.data().role !== expectedRole) {
    window.location.href = '/login.html';
    return null;
  }
  return { uid: user.uid, ...snap.data() };
}
