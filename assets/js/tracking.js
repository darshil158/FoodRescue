// ============================================================
// FoodRescue — Volunteer Tracking & QR Code System
// ============================================================

import { db } from './firebase-config.js';
import {
  doc, updateDoc, serverTimestamp, GeoPoint
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { updateDonationStatus } from './firestore.js';
import { showToast } from './notifications.js';

let trackingInterval = null;

// ── Start Live Volunteer Tracking ───────────────────────────

export function startVolunteerTracking(donationId, volunteerId) {
  if (trackingInterval) clearInterval(trackingInterval);

  const updateLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const geoPoint = new GeoPoint(pos.coords.latitude, pos.coords.longitude);
      await updateDoc(doc(db, 'donations', donationId), {
        volunteerLocation:   geoPoint,
        volunteerUpdatedAt:  serverTimestamp()
      });
      await updateDoc(doc(db, 'volunteers', volunteerId), {
        currentLocation: geoPoint
      });
    }, (err) => console.warn('Geolocation error:', err), {
      enableHighAccuracy: true,
      timeout: 8000
    });
  };

  updateLocation(); // immediate
  trackingInterval = setInterval(updateLocation, 30000);
  return trackingInterval;
}

export function stopVolunteerTracking() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
}

// ── QR Code Generator (using qrcode.js) ─────────────────────
// Requires: <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>

export function generateQRCode(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (typeof QRCode === 'undefined') {
    container.innerHTML = `<div style="padding:1rem;text-align:center;font-size:.8rem;color:#666">QR: ${data}</div>`;
    return;
  }
  return new QRCode(container, {
    text: data,
    width:  160,
    height: 160,
    colorDark:  '#0b2a1a',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
}

export function generatePickupQRData(donationId, donorId) {
  return JSON.stringify({ type: 'pickup', donationId, donorId, ts: Date.now() });
}

export function generateDeliveryQRData(donationId, ngoId) {
  return JSON.stringify({ type: 'delivery', donationId, ngoId, ts: Date.now() });
}

// ── QR Code Scanner (Camera) ────────────────────────────────
// Uses browser MediaDevices API

let scanStream = null;

export function startQRScanner(videoId, onScan) {
  const video = document.getElementById(videoId);
  if (!video) return;
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      scanStream = stream;
      video.srcObject = stream;
      video.play();
      scanFrame(video, onScan);
    })
    .catch(err => {
      showToast('Camera Error', 'Cannot access camera for QR scanning.', 'error');
      console.error(err);
    });
}

function scanFrame(video, onScan) {
  if (!video.paused && !video.ended && 'BarcodeDetector' in window) {
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    detector.detect(video)
      .then(barcodes => {
        if (barcodes.length > 0) {
          const raw = barcodes[0].rawValue;
          stopQRScanner();
          try { onScan(JSON.parse(raw)); }
          catch { onScan(raw); }
          return;
        }
      });
  }
  requestAnimationFrame(() => scanFrame(video, onScan));
}

export function stopQRScanner() {
  if (scanStream) {
    scanStream.getTracks().forEach(t => t.stop());
    scanStream = null;
  }
}

// ── Status Pipeline State Machine ───────────────────────────

const STATUS_PIPELINE = [
  'posted', 'matched', 'accepted', 'assigned',
  'pickup_en_route', 'picked_up', 'delivering', 'delivered', 'completed'
];

export function getNextStatus(currentStatus) {
  const idx = STATUS_PIPELINE.indexOf(currentStatus);
  return idx >= 0 && idx < STATUS_PIPELINE.length - 1
    ? STATUS_PIPELINE[idx + 1]
    : null;
}

export async function advanceDonationStatus(donationId, currentStatus, actorId, actorRole, extra = {}) {
  const next = getNextStatus(currentStatus);
  if (!next) return false;
  await updateDonationStatus(donationId, next, actorId, actorRole, extra);

  // Side effects
  if (next === 'picked_up') {
    await updateDoc(doc(db, 'donations', donationId), {
      pickupScannedAt: serverTimestamp()
    });
    showToast('✅ Pickup Confirmed', 'Food pickup QR scan recorded.', 'success');
  }
  if (next === 'delivered' || next === 'completed') {
    await updateDoc(doc(db, 'donations', donationId), {
      deliveryScannedAt: serverTimestamp()
    });
    stopVolunteerTracking();
    showToast('❤️ Delivery Confirmed', 'Impact report will be sent shortly.', 'success');
  }
  return next;
}

// ── Status Timeline Renderer ────────────────────────────────

export function renderStatusTimeline(container, currentStatus, timestamps = {}) {
  const stages = [
    { key: 'posted',         icon: '📋', label: 'Food Posted' },
    { key: 'accepted',       icon: '✅', label: 'NGO Accepted' },
    { key: 'assigned',       icon: '👤', label: 'Volunteer Assigned' },
    { key: 'pickup_en_route',icon: '🛵', label: 'En Route' },
    { key: 'picked_up',      icon: '📦', label: 'Picked Up' },
    { key: 'delivering',     icon: '🚗', label: 'Delivering' },
    { key: 'delivered',      icon: '❤️', label: 'Delivered' },
    { key: 'completed',      icon: '🏆', label: 'Completed' }
  ];
  const currentIdx = STATUS_PIPELINE.indexOf(currentStatus);

  container.innerHTML = `<div class="status-timeline">
    ${stages.map((s, i) => {
      let cls = 'timeline-step';
      if (i < currentIdx)  cls += ' completed';
      if (i === currentIdx) cls += ' active';
      const time = timestamps[s.key] ? formatTimestamp(timestamps[s.key]) : '';
      return `
        <div class="${cls}">
          <div class="step-dot ${i === currentIdx ? 'pulse-saffron' : ''}">${i < currentIdx ? '✓' : s.icon}</div>
          <div class="step-dot-label">${s.label}</div>
          ${time ? `<div class="step-dot-time">${time}</div>` : ''}
        </div>
      `;
    }).join('')}
  </div>`;
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ── CSR Certificate Generator ───────────────────────────────

export function generateCertificate(restaurant, year) {
  const canvas = document.createElement('canvas');
  canvas.width  = 1200;
  canvas.height = 850;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#f9fdf9';
  ctx.fillRect(0, 0, 1200, 850);

  // Green border
  ctx.strokeStyle = '#226940';
  ctx.lineWidth = 12;
  ctx.strokeRect(30, 30, 1140, 790);

  // Inner border accent
  ctx.strokeStyle = '#f5921e';
  ctx.lineWidth = 2;
  ctx.strokeRect(44, 44, 1112, 762);

  // Header
  ctx.fillStyle = '#0b2a1a';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FoodRescue Foundation', 600, 120);

  ctx.fillStyle = '#226940';
  ctx.font = '22px sans-serif';
  ctx.fillText('Certificate of Social Impact', 600, 160);

  // Saffron divider
  ctx.strokeStyle = '#f5921e';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(200, 185); ctx.lineTo(1000, 185); ctx.stroke();

  // Subtitle
  ctx.fillStyle = '#506050';
  ctx.font = '16px sans-serif';
  ctx.fillText('This certifies that the following establishment has actively contributed to food rescue efforts', 600, 220);

  // Business name
  ctx.fillStyle = '#0b2a1a';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText(restaurant.businessName || 'Partner Restaurant', 600, 300);

  // Impact headline
  ctx.fillStyle = '#226940';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(
    (restaurant.totalMealsSaved || 0).toLocaleString('en-IN') + ' Meals',
    600, 390
  );

  ctx.fillStyle = '#506050';
  ctx.font = '20px sans-serif';
  ctx.fillText(
    `donated in ${year} | ${restaurant.totalFoodKg || 0} kg food rescued`,
    600, 430
  );
  ctx.fillText(
    `CO₂ offset: ${restaurant.co2Saved || 0} kg | SDG 2, 12, 13, 17 Compliant`,
    600, 465
  );

  // Divider
  ctx.strokeStyle = '#93d9ac';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(200, 500); ctx.lineTo(1000, 500); ctx.stroke();

  // SDG badges text
  ctx.fillStyle = '#133d26';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('United Nations Sustainable Development Goals:', 600, 540);
  ctx.fillStyle = '#3da668';
  ctx.font = '15px sans-serif';
  ctx.fillText('SDG 2: Zero Hunger  |  SDG 12: Responsible Consumption  |  SDG 13: Climate Action  |  SDG 17: Partnerships', 600, 568);

  // Signature line
  ctx.strokeStyle = '#93d9ac';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(300, 680); ctx.lineTo(550, 680); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(650, 680); ctx.lineTo(900, 680); ctx.stroke();
  ctx.fillStyle = '#506050';
  ctx.font = '13px sans-serif';
  ctx.fillText('Authorized Signatory', 425, 705);
  ctx.fillText('Date Issued', 775, 705);

  // Footer
  ctx.fillStyle = '#8fa08f';
  ctx.font = '12px sans-serif';
  ctx.fillText(`Generated by FoodRescue Platform | Rescuing Surplus Food, Feeding Lives | ${new Date().getFullYear()}`, 600, 790);

  const link = document.createElement('a');
  link.download = `FoodRescue_Certificate_${year}_${(restaurant.businessName || 'Partner').replace(/\s+/g, '_')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
