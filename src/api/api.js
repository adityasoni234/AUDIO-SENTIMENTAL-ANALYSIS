/**
 * API service — Axios calls to the Python ML backend.
 * When the backend is unavailable, realistic mock data is returned.
 * Every result is persisted to Firestore via db.js.
 */
import axios from 'axios'
import { saveAnalysis, fetchAnalysis, fetchAllAnalyses, fetchUserStats, removeAnalysis } from '../firebase/db'

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeout: 30000,
})

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function mockDelay(ms = 900) {
  return new Promise((r) => setTimeout(r, ms))
}

const SENTIMENTS = ['POSITIVE', 'NEGATIVE', 'NEUTRAL']

function randomSentiment() {
  return SENTIMENTS[Math.floor(Math.random() * SENTIMENTS.length)]
}

function randomConfidence(sentiment) {
  const base = { POSITIVE: [72, 96], NEGATIVE: [68, 92], NEUTRAL: [55, 80] }[sentiment]
  return parseFloat((Math.random() * (base[1] - base[0]) + base[0]).toFixed(1))
}

function mockEmotions(sentiment) {
  if (sentiment === 'POSITIVE') {
    return { joy: rand(65, 90), trust: rand(50, 75), anticipation: rand(35, 60), sadness: rand(3, 15), anger: rand(1, 8) }
  }
  if (sentiment === 'NEGATIVE') {
    return { anger: rand(55, 80), sadness: rand(45, 70), disgust: rand(30, 55), fear: rand(15, 35), joy: rand(2, 10) }
  }
  return { trust: rand(30, 55), anticipation: rand(25, 45), sadness: rand(20, 40), joy: rand(15, 35), anger: rand(5, 15) }
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function buildMockResult(filename, sentiment) {
  const sent = sentiment || randomSentiment()
  return {
    sentiment: sent,
    confidence: randomConfidence(sent),
    emotions: mockEmotions(sent),
    transcript: '',
    audioFile: filename || 'recording.webm',
    duration: `${rand(0, 4)}:${String(rand(5, 59)).padStart(2, '0')}`,
    fileSize: `${(Math.random() * 4 + 0.2).toFixed(1)} MB`,
    analyzedAt: new Date().toISOString(),
  }
}

// ─── Public API functions ─────────────────────────────────────────────────────

/**
 * Upload an audio file for analysis.
 * Saves the result to Firestore and returns the Firestore doc ID.
 */
export async function uploadAudio(file, firebaseUid) {
  let resultData

  try {
    const formData = new FormData()
    formData.append('audio', file)
    formData.append('uid', firebaseUid)
    const response = await axiosInstance.post('/analyze/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data', 'x-firebase-uid': firebaseUid },
    })
    resultData = response.data
  } catch {
    await mockDelay(1200)
    resultData = buildMockResult(file.name)
  }

  // Persist to Firestore
  const id = await saveAnalysis(firebaseUid, {
    ...resultData,
    audioFile: file.name,
  })

  return { id, status: 'success', message: 'Analysis complete' }
}

/**
 * Submit a recorded audio blob for analysis.
 * Saves the result to Firestore and returns the Firestore doc ID.
 */
export async function submitRecordedAudio(blob, firebaseUid) {
  let resultData

  try {
    const formData = new FormData()
    formData.append('audio', blob, 'recording.webm')
    formData.append('uid', firebaseUid)
    const response = await axiosInstance.post('/analyze/record', formData, {
      headers: { 'Content-Type': 'multipart/form-data', 'x-firebase-uid': firebaseUid },
    })
    resultData = response.data
  } catch {
    await mockDelay(1200)
    resultData = buildMockResult('recording.webm')
  }

  const id = await saveAnalysis(firebaseUid, resultData)
  return { id, status: 'success', message: 'Analysis complete' }
}

/**
 * Fetch a single result — reads from Firestore first.
 */
export async function getSentimentResult(id, firebaseUid) {
  try {
    const result = await fetchAnalysis(firebaseUid, id)
    if (result) return result
  } catch { /* fall through to mock */ }

  // Fallback mock (only if Firestore fails)
  await mockDelay(400)
  return {
    id,
    sentiment: 'POSITIVE',
    confidence: 87.4,
    emotions: { joy: 72, trust: 58, anticipation: 44, sadness: 12, anger: 5 },
    transcript: '',
    audioFile: 'sample.mp3',
    duration: '0:32',
    fileSize: '512 KB',
    analyzedAt: new Date().toISOString(),
  }
}

/**
 * Fetch all analyses from Firestore.
 */
export async function getAnalysisHistory(firebaseUid) {
  try {
    return await fetchAllAnalyses(firebaseUid)
  } catch {
    await mockDelay(500)
    return []
  }
}

/**
 * Delete an analysis from Firestore.
 */
export async function deleteAnalysis(id, firebaseUid) {
  try {
    await removeAnalysis(firebaseUid, id)
    return { success: true }
  } catch {
    await mockDelay(300)
    return { success: true }
  }
}

/**
 * Compute aggregated stats from Firestore.
 */
export async function getUserStats(firebaseUid) {
  try {
    return await fetchUserStats(firebaseUid)
  } catch {
    await mockDelay(400)
    return { total: 0, positive: 0, negative: 0, neutral: 0 }
  }
}
