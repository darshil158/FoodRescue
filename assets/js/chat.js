// ============================================================
// FoodRescue — Real-Time Chat System
// ============================================================

import { db, auth } from './firebase-config.js';
import {
  collection, addDoc, query, orderBy, limit, onSnapshot,
  updateDoc, doc, where, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let activeChatDonationId = null;
let chatUnsubscribe = null;
let unreadTotal = 0;

// ── Send Message ────────────────────────────────────────────

export async function sendChatMessage(donationId, messageText, senderData) {
  if (!messageText.trim()) return;
  await addDoc(collection(db, 'donations', donationId, 'chat'), {
    senderId:   senderData.uid,
    senderName: senderData.name,
    senderRole: senderData.role,
    message:    messageText.trim(),
    timestamp:  serverTimestamp(),
    read:       false
  });
}

// ── Listen to Chat ──────────────────────────────────────────

export function listenToChat(donationId, callback) {
  if (chatUnsubscribe) chatUnsubscribe();
  activeChatDonationId = donationId;
  const q = query(
    collection(db, 'donations', donationId, 'chat'),
    orderBy('timestamp', 'asc'),
    limit(100)
  );
  chatUnsubscribe = onSnapshot(q, (snap) => {
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(messages);
    markAllRead(donationId);
  });
  return chatUnsubscribe;
}

// ── Mark as Read ────────────────────────────────────────────

async function markAllRead(donationId) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const q = query(
    collection(db, 'donations', donationId, 'chat'),
    where('read', '==', false)
  );
  const snap = await getDocs(q);
  snap.docs.forEach(async (d) => {
    if (d.data().senderId !== uid) {
      await updateDoc(doc(db, 'donations', donationId, 'chat', d.id), { read: true });
    }
  });
}

// ── Chat UI ─────────────────────────────────────────────────

export function initChatUI(currentUser) {
  const fab     = document.querySelector('.chat-fab');
  const panel   = document.querySelector('.chat-panel');
  const sendBtn = document.querySelector('.chat-send');
  const input   = document.querySelector('.chat-input');
  const msgs    = document.querySelector('.chat-messages');

  if (!fab || !panel) return;

  fab.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open') && activeChatDonationId) {
      scrollToBottom(msgs);
    }
  });

  if (sendBtn && input) {
    const send = async () => {
      const text = input.value.trim();
      if (!text || !activeChatDonationId) return;
      input.value = '';
      await sendChatMessage(activeChatDonationId, text, currentUser);
    };
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
  }
}

export function openChatForDonation(donationId, currentUser, partnerName = '') {
  activeChatDonationId = donationId;
  const panel = document.querySelector('.chat-panel');
  const msgs  = document.querySelector('.chat-messages');
  const hdr   = document.querySelector('.chat-header .chat-partner-name');
  if (hdr) hdr.textContent = partnerName;
  if (panel) panel.classList.add('open');

  listenToChat(donationId, (messages) => {
    if (!msgs) return;
    msgs.innerHTML = messages.map(m => renderChatMessage(m, currentUser.uid)).join('');
    scrollToBottom(msgs);
  });
}

function renderChatMessage(msg, currentUid) {
  const isSent = msg.senderId === currentUid;
  const time   = msg.timestamp?.toDate
    ? formatTime(msg.timestamp.toDate())
    : '';
  return `
    <div class="chat-message ${isSent ? 'sent' : 'received'}">
      ${msg.message}
      <div class="chat-timestamp">${time} ${isSent ? '✓✓' : ''}</div>
    </div>
  `;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function scrollToBottom(el) {
  if (el) el.scrollTop = el.scrollHeight;
}

// ── Unread Count Across All Chats ──────────────────────────

export function watchUnreadCount(uid, donationIds, callback) {
  let total = 0;
  donationIds.forEach(donationId => {
    const q = query(
      collection(db, 'donations', donationId, 'chat'),
      where('read', '==', false)
    );
    onSnapshot(q, (snap) => {
      const unread = snap.docs.filter(d => d.data().senderId !== uid).length;
      total += unread;
      callback(total);
      const badge = document.querySelector('.chat-badge');
      if (badge) {
        badge.textContent = total;
        badge.style.display = total > 0 ? 'flex' : 'none';
      }
    });
  });
}
