// ============================================================
// FoodRescue — Firestore CRUD, Algorithms & Real-time Listeners
// ============================================================

import { db } from './firebase-config.js';
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit, onSnapshot,
  serverTimestamp, GeoPoint, increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── Donation CRUD ───────────────────────────────────────────

export async function createDonation(donorId, data) {
  const safetyScore = calculateFoodSafetyScore(data);
  const payload = {
    donorId,
    donorName:     data.donorName || '',
    donorType:     data.donorType || 'restaurant',
    foodName:      data.foodName,
    foodCategory:  data.foodCategory,
    foodTypes:     data.foodTypes || [],
    quantity:      parseFloat(data.quantity),
    quantityUnit:  data.quantityUnit,
    servings:      parseInt(data.servings),
    preparedAt:    data.preparedAt,
    expiresAt:     data.expiresAt,
    imageUrl:      data.imageUrl || '',
    pickupAddress: data.pickupAddress,
    pickupLocation: data.pickupLocation
      ? new GeoPoint(data.pickupLocation.lat, data.pickupLocation.lng)
      : null,
    contactNumber:       data.contactNumber,
    specialInstructions: data.specialInstructions || '',
    packaged:            !!data.packaged,
    status:              'posted',
    assignedNgoId:       null,
    assignedNgoName:     null,
    assignedVolunteerId: null,
    assignedVolunteerName: null,
    volunteerLocation:   null,
    isEmergency:  !!data.isEmergency,
    isScheduled:  !!data.isScheduled,
    schedule:     data.schedule || null,
    pickupQrCode:    data.pickupQrCode    || '',
    deliveryQrCode:  data.deliveryQrCode  || '',
    pickupScannedAt:   null,
    deliveryScannedAt: null,
    foodSafetyCheck: {
      preparedWithin4h: safetyScore.preparedWithin4h,
      imageUploaded:    !!data.imageUrl,
      packaged:         !!data.packaged,
      verifiedDonor:    !!data.donorVerified,
      score:            safetyScore.total
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, 'donations'), payload);

  // Add timeline event
  await addDoc(collection(db, 'donations', ref.id, 'timeline'), {
    status: 'posted', message: 'Donation posted by restaurant',
    actorId: donorId, actorRole: 'restaurant',
    timestamp: serverTimestamp(), location: null
  });

  // Update restaurant stats
  await updateDoc(doc(db, 'restaurants', donorId), {
    totalDonations: increment(1)
  });

  return ref.id;
}

export async function updateDonationStatus(donationId, status, actorId, actorRole, extra = {}) {
  const updates = {
    status,
    updatedAt: serverTimestamp(),
    ...extra
  };
  await updateDoc(doc(db, 'donations', donationId), updates);

  const messages = {
    matched:       'Matched with an NGO',
    accepted:      'NGO accepted the donation',
    assigned:      'Volunteer assigned for pickup',
    pickup_en_route: 'Volunteer en route to pickup',
    picked_up:     'Food picked up by volunteer',
    delivering:    'Volunteer en route to NGO',
    delivered:     'Food delivered to NGO',
    completed:     'Delivery confirmed and completed',
    expired:       'Donation expired without pickup'
  };

  await addDoc(collection(db, 'donations', donationId, 'timeline'), {
    status, actorId, actorRole,
    message: messages[status] || status,
    timestamp: serverTimestamp(),
    location: null
  });
}

// ── Donation Queries ────────────────────────────────────────

export async function getDonationsByStatus(status, limitN = 20) {
  const q = query(
    collection(db, 'donations'),
    where('status', '==', status),
    orderBy('createdAt', 'desc'),
    limit(limitN)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getDonationsByDonor(donorId, limitN = 50) {
  const q = query(
    collection(db, 'donations'),
    where('donorId', '==', donorId),
    orderBy('createdAt', 'desc'),
    limit(limitN)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getDonationsByNGO(ngoId, limitN = 50) {
  const q = query(
    collection(db, 'donations'),
    where('assignedNgoId', '==', ngoId),
    orderBy('createdAt', 'desc'),
    limit(limitN)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getDonationsByVolunteer(volunteerId, limitN = 50) {
  const q = query(
    collection(db, 'donations'),
    where('assignedVolunteerId', '==', volunteerId),
    orderBy('createdAt', 'desc'),
    limit(limitN)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Real-time Listeners ─────────────────────────────────────

export function listenActiveDonations(callback) {
  const q = query(
    collection(db, 'donations'),
    where('status', 'in', ['posted', 'matched']),
    orderBy('createdAt', 'desc'),
    limit(30)
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(docs);
  });
}

export function listenDonation(donationId, callback) {
  return onSnapshot(doc(db, 'donations', donationId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
}

export function listenVolunteerTasks(volunteerId, callback) {
  const q = query(
    collection(db, 'donations'),
    where('assignedVolunteerId', '==', volunteerId),
    where('status', 'in', ['assigned', 'pickup_en_route', 'picked_up', 'delivering'])
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export function listenEmergencies(callback) {
  const q = query(
    collection(db, 'emergencies'),
    where('active', '==', true),
    limit(1)
  );
  return onSnapshot(q, (snap) => {
    if (!snap.empty) {
      callback({ id: snap.docs[0].id, ...snap.docs[0].data() });
    } else {
      callback(null);
    }
  });
}

export function listenGlobalStats(callback) {
  return onSnapshot(doc(db, 'analytics', 'global'), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

// ── Users & Profiles ────────────────────────────────────────

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() });
}

export async function getAllUsers(limitN = 100) {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(limitN)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPendingVerifications(role) {
  const q = query(
    collection(db, 'users'),
    where('role', '==', role),
    where('verificationStatus', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function approveUser(uid) {
  await updateDoc(doc(db, 'users', uid), {
    verified: true,
    verificationStatus: 'approved',
    updatedAt: serverTimestamp()
  });
}

export async function rejectUser(uid, reason = '') {
  await updateDoc(doc(db, 'users', uid), {
    verified: false,
    verificationStatus: 'rejected',
    rejectionReason: reason,
    updatedAt: serverTimestamp()
  });
}

// ── Volunteer Management ────────────────────────────────────

export async function getNearbyVolunteers(location, radiusKm = 5) {
  // In production, use GeoFirestore or Firestore geo queries
  // For now, fetch all available volunteers and filter client-side
  const q = query(
    collection(db, 'volunteers'),
    where('available', '==', true)
  );
  const snap = await getDocs(q);
  const volunteers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return volunteers.filter(v => {
    if (!v.currentLocation) return false;
    const dist = haversineDistance(location, {
      lat: v.currentLocation.latitude,
      lng: v.currentLocation.longitude
    });
    return dist <= radiusKm;
  }).sort((a, b) => {
    const dA = haversineDistance(location, { lat: a.currentLocation.latitude, lng: a.currentLocation.longitude });
    const dB = haversineDistance(location, { lat: b.currentLocation.latitude, lng: b.currentLocation.longitude });
    return dA - dB;
  });
}

export async function updateVolunteerAvailability(volunteerId, available) {
  await updateDoc(doc(db, 'volunteers', volunteerId), { available });
}

export async function addVolunteerRewardPoints(volunteerId, points) {
  const snap = await getDoc(doc(db, 'volunteers', volunteerId));
  if (!snap.exists()) return;
  const current = snap.data().rewardPoints || 0;
  const newTotal = current + points;
  const tier = newTotal >= 2000 ? 'guardian' : newTotal >= 500 ? 'sapling' : 'seedling';
  await updateDoc(doc(db, 'volunteers', volunteerId), {
    rewardPoints: newTotal, tier,
    consecutiveRejections: 0
  });
}

export async function incrementVolunteerRejections(volunteerId) {
  await updateDoc(doc(db, 'volunteers', volunteerId), {
    consecutiveRejections: increment(1)
  });
}

// ── NGO Matching Algorithm ──────────────────────────────────
// Match Score = 0.3×(1/Distance) + 0.3×NeedLevel + 0.2×Capacity + 0.2×(1/TimeToExpiry)

export async function rankNGOs(donation) {
  const snap = await getDocs(query(
    collection(db, 'users'),
    where('role', '==', 'ngo'),
    where('verified', '==', true)
  ));
  const ngoIds = snap.docs.map(d => d.id);
  const ngoProfiles = await Promise.all(
    ngoIds.map(id => getDoc(doc(db, 'ngos', id)).then(s => s.exists() ? { uid: id, ...s.data() } : null))
  );
  const ngos = ngoProfiles.filter(Boolean);
  const urgencyHours = (new Date(donation.expiresAt) - Date.now()) / (1000 * 60 * 60);
  const pickupLoc = donation.pickupLocation
    ? { lat: donation.pickupLocation.latitude, lng: donation.pickupLocation.longitude }
    : null;

  const scored = ngos.map(ngo => {
    let score = 0;
    if (pickupLoc && ngo.location) {
      const distKm = haversineDistance(pickupLoc, ngo.location);
      if (distKm <= 1)  score += 40;
      else if (distKm <= 3)  score += 30;
      else if (distKm <= 5)  score += 20;
      else if (distKm <= 10) score += 10;
    }
    const capacityLeft = (ngo.capacity || 0) - (ngo.currentLoad || 0);
    if (capacityLeft >= donation.servings)             score += 30;
    else if (capacityLeft >= donation.servings * 0.7)  score += 20;
    else if (capacityLeft > 0)                          score += 10;
    if (urgencyHours < 1 && (ngo.avgResponseTime || 60) < 15) score += 20;
    else if (urgencyHours < 2) score += 15;
    else score += 10;
    score += Math.min((ngo.reliabilityScore || 100) / 10, 10);
    const distKm = pickupLoc && ngo.location ? haversineDistance(pickupLoc, ngo.location) : 99;
    return { ...ngo, matchScore: score, distKm };
  });
  return scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
}

// ── Food Safety Score Algorithm ─────────────────────────────

export function calculateFoodSafetyScore(donation) {
  let score = 0;
  const hoursAgo = donation.preparedAt
    ? (Date.now() - new Date(donation.preparedAt)) / (1000 * 60 * 60)
    : 99;

  const imageUploaded = !!donation.imageUrl;
  if (imageUploaded) score += 25;

  let preparedWithin4h = false;
  if (hoursAgo <= 1)      { score += 35; preparedWithin4h = true; }
  else if (hoursAgo <= 2) { score += 30; preparedWithin4h = true; }
  else if (hoursAgo <= 3) { score += 20; preparedWithin4h = true; }
  else if (hoursAgo <= 4) { score += 10; preparedWithin4h = true; }

  if (donation.packaged)      score += 20;
  if (donation.donorVerified) score += 20;
  if (donation.fssaiCertified) score += 5;

  return { total: Math.min(score, 100), preparedWithin4h, imageUploaded };
}

export function getSafetyBadge(score) {
  if (score >= 85) return { label: 'Excellent', color: '#2d8653', icon: '🛡️', cls: 'score-excellent' };
  if (score >= 70) return { label: 'Good',      color: '#5ec285', icon: '✅', cls: 'score-good' };
  if (score >= 50) return { label: 'Fair',      color: '#f5921e', icon: '⚠️', cls: 'score-fair' };
  return               { label: 'Caution',      color: '#d44c4c', icon: '🔴', cls: 'score-caution' };
}

export function getFSSAIExpiry(foodCategory, preparedAt) {
  const prepared = new Date(preparedAt);
  switch (foodCategory) {
    case 'hot_cooked':    return new Date(prepared.getTime() + 4  * 3600000);
    case 'refrigerated':  return new Date(prepared.getTime() + 24 * 3600000);
    case 'fresh_produce': return new Date(prepared.setHours(23, 59, 59, 999));
    case 'bakery':        return new Date(prepared.setHours(23, 59, 59, 999));
    default:              return new Date(prepared.getTime() + 4  * 3600000);
  }
}

// ── Global Analytics ────────────────────────────────────────

export async function getGlobalStats() {
  const snap = await getDoc(doc(db, 'analytics', 'global'));
  if (snap.exists()) return snap.data();
  // Fallback demo data
  return {
    totalMealsSaved: 320000,
    totalFoodKg: 4200,
    activeNGOs: 280,
    activeVolunteers: 1100,
    totalDonations: 8500,
    co2Saved: 62000,
    waterSaved: 180000
  };
}

export async function updateGlobalStats(delta) {
  await updateDoc(doc(db, 'analytics', 'global'), {
    ...delta,
    updatedAt: serverTimestamp()
  });
}

// ── Reports ──────────────────────────────────────────────────

export async function submitReport(data) {
  await addDoc(collection(db, 'reports'), {
    ...data,
    status: 'open',
    createdAt: serverTimestamp()
  });
}

export async function getReports(status = null) {
  let q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(50));
  if (status) q = query(collection(db, 'reports'), where('status', '==', status), orderBy('createdAt', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Emergency Management ────────────────────────────────────

export async function createEmergency(data, adminId) {
  await addDoc(collection(db, 'emergencies'), {
    ...data,
    active: true,
    createdBy: adminId,
    createdAt: serverTimestamp()
  });
}

export async function deactivateEmergency(emergencyId) {
  await updateDoc(doc(db, 'emergencies', emergencyId), { active: false });
}

// ── Utility ──────────────────────────────────────────────────

export function haversineDistance(loc1, loc2) {
  const R = 6371;
  const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
  const dLon = (loc2.lng - loc1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(loc1.lat * Math.PI / 180) *
    Math.cos(loc2.lat * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function co2FromKg(kg) { return (kg * 1.8).toFixed(1); }
export function waterFromKg(kg) { return Math.round(kg * 500); }
