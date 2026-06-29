// ============================================================
// FoodRescue — Notifications, Toasts & FCM
// ============================================================

import { messaging, db, auth } from './firebase-config.js';
import { doc, updateDoc, collection, query, where, orderBy, limit, onSnapshot } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let toastContainer = null;

function getToastContainer() {
  if (toastContainer) return toastContainer;
  toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

// ── Toast Notification ──────────────────────────────────────

export function showToast(title, body = '', type = 'success', duration = 5000) {
  const container = getToastContainer();
  const icons = { success: '✅', error: '❌', warn: '⚠️', info: 'ℹ️', emergency: '🚨' };
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'warn' ? 'toast-warn' : ''}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || '🔔'}</div>
    <div>
      <div class="toast-title">${title}</div>
      ${body ? `<div class="toast-body">${body}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Close">&times;</button>
  `;
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));
  container.appendChild(toast);
  if (duration > 0) setTimeout(() => removeToast(toast), duration);
  return toast;
}

function removeToast(toast) {
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(100%)';
  toast.style.transition = 'all 0.3s ease';
  setTimeout(() => toast.remove(), 300);
}

// ── FCM Registration ────────────────────────────────────────

export async function registerForNotifications() {
  if (!messaging) {
    console.warn('FCM not available in this context (requires HTTPS)');
    return;
  }
  try {
    const { getToken, onMessage } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js");
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return;
    }
    const token = await getToken(messaging, {
      vapidKey: 'YOUR_VAPID_PUBLIC_KEY'
    });
    if (token && auth.currentUser) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { fcmToken: token });
    }
    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      showToast(title || 'Notification', body || '', 'info');
    });
  } catch (err) {
    console.warn('FCM registration failed:', err);
  }
}

// ── In-app Notification Bell ────────────────────────────────

export function listenUserNotifications(uid, callback) {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', uid),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  return onSnapshot(q, (snap) => {
    const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(notifs);
    updateNotifBadge(notifs.length);
  });
}

function updateNotifBadge(count) {
  document.querySelectorAll('.notif-count-badge').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'flex' : 'none';
  });
  const notifDots = document.querySelectorAll('.dash-topbar-btn .notif-dot');
  notifDots.forEach(el => {
    el.style.display = count > 0 ? 'block' : 'none';
  });
}

export async function markNotificationRead(notifId) {
  const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
  await updateDoc(doc(db, 'notifications', notifId), { read: true });
}

// ── Notification type templates ─────────────────────────────

export const NOTIFICATION_TEMPLATES = {
  food_posted: (donor, food, dist) => ({
    title: `🍽️ New Food Available`,
    body:  `${donor} donated ${food} — ${dist} km away`
  }),
  ngo_accepted: (ngo) => ({
    title: `✅ NGO Accepted`,
    body:  `${ngo} accepted your donation and will arrange pickup`
  }),
  volunteer_assigned: (name, vehicle) => ({
    title: `🛵 Volunteer Assigned`,
    body:  `${name} (${vehicle}) will pick up your food`
  }),
  pickup_scanned: (name) => ({
    title: `📦 Food Picked Up`,
    body:  `${name} has picked up the food and is en route`
  }),
  delivery_scanned: () => ({
    title: `❤️ Delivery Confirmed`,
    body:  `Food has been delivered to the NGO successfully`
  }),
  verification_approved: () => ({
    title: `🟢 Account Verified`,
    body:  `Your account has been verified by FoodRescue admin`
  }),
  emergency: (title, loc) => ({
    title: `🚨 Emergency Alert`,
    body:  `${title} — ${loc}. All volunteers mobilized.`
  })
};
