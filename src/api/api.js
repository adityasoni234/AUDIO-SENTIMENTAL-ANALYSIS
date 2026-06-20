/**
 * API service — Axios calls to the Python ML backend.
 * No mock data — all results come from the real model.
 * Results are persisted to Firestore via db.js.
 */
import axios from 'axios'
import { saveAnalysis, fetchAnalysis, fetchAllAnalyses, fetchUserStats, removeAnalysis } from '../firebase/db'

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeout: 60000,
})

/**
 * Upload an audio file for analysis.
 * Saves the result to Firestore and returns the Firestore doc ID.
 */
export async function uploadAudio(file, firebaseUid) {
  const formData = new FormData()
  formData.append('audio', file)
  formData.append('uid', firebaseUid)

  const response = await axiosInstance.post('/analyze/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data', 'x-firebase-uid': firebaseUid },
  })

  const resultData = { ...response.data, audioFile: file.name }

  let id = 'local-' + Date.now()
  try {
    id = await saveAnalysis(firebaseUid, resultData)
  } catch (e) {
    console.warn('Firestore save failed, using local result:', e?.message)
  }

  return { id, result: resultData, status: 'success' }
}

/**
 * Submit a recorded audio blob for analysis.
 * Saves the result to Firestore and returns the Firestore doc ID.
 */
export async function submitRecordedAudio(blob, firebaseUid) {
  const formData = new FormData()
  formData.append('audio', blob, 'recording.webm')
  formData.append('uid', firebaseUid)

  const response = await axiosInstance.post('/analyze/record', formData, {
    headers: { 'Content-Type': 'multipart/form-data', 'x-firebase-uid': firebaseUid },
  })

  const resultData = response.data

  let id = 'local-' + Date.now()
  try {
    id = await saveAnalysis(firebaseUid, resultData)
  } catch (e) {
    console.warn('Firestore save failed, using local result:', e?.message)
  }

  return { id, result: resultData, status: 'success' }
}

/**
 * Fetch a single result from Firestore.
 */
export async function getSentimentResult(id, firebaseUid) {
  const result = await fetchAnalysis(firebaseUid, id)
  if (!result) throw new Error(`Analysis ${id} not found`)
  return result
}

/**
 * Fetch all analyses from Firestore.
 */
export async function getAnalysisHistory(firebaseUid) {
  return fetchAllAnalyses(firebaseUid)
}

/**
 * Delete an analysis from Firestore.
 */
export async function deleteAnalysis(id, firebaseUid) {
  await removeAnalysis(firebaseUid, id)
  return { success: true }
}

/**
 * Compute aggregated stats from Firestore.
 */
export async function getUserStats(firebaseUid) {
  return fetchUserStats(firebaseUid)
}
