/**
 * Firestore database service
 * All analysis results are persisted here.
 * Collection structure:
 *   users/{uid}/analyses/{analysisId}
 */
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function analysesRef(uid) {
  return collection(db, 'users', uid, 'analyses')
}

function analysisDocRef(uid, id) {
  return doc(db, 'users', uid, 'analyses', id)
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Save an analysis result to Firestore.
 * @param {string} uid  Firebase user UID
 * @param {object} data Result object (sentiment, confidence, emotions, etc.)
 * @returns {Promise<string>} Firestore document ID
 */
export async function saveAnalysis(uid, data) {
  const ref = await addDoc(analysesRef(uid), {
    ...data,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetch a single analysis result.
 * @param {string} uid
 * @param {string} id  Firestore document ID
 * @returns {Promise<object|null>}
 */
export async function fetchAnalysis(uid, id) {
  const snap = await getDoc(analysisDocRef(uid, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

/**
 * Fetch all analyses for a user, newest first.
 * @param {string} uid
 * @returns {Promise<object[]>}
 */
export async function fetchAllAnalyses(uid) {
  const q = query(analysesRef(uid), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Compute stats from all user analyses.
 * @param {string} uid
 * @returns {Promise<{total, positive, negative, neutral}>}
 */
export async function fetchUserStats(uid) {
  const all = await fetchAllAnalyses(uid)
  return {
    total: all.length,
    positive: all.filter((a) => a.sentiment === 'POSITIVE').length,
    negative: all.filter((a) => a.sentiment === 'NEGATIVE').length,
    neutral:  all.filter((a) => a.sentiment === 'NEUTRAL').length,
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Delete a single analysis record.
 * @param {string} uid
 * @param {string} id
 */
export async function removeAnalysis(uid, id) {
  await deleteDoc(analysisDocRef(uid, id))
}
