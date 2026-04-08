// ============================================================
// FILE: routes/ai.js
// ============================================================
const router_ai = require('express').Router()
const { explainDrift, reclassifySeverity, getRemediationRecommendation, detectAnomalies } = require('../services/aiService')
const { getDriftRecords } = require('../services/blobService')
 
// ── POST /api/ai/explain START ───────────────────────────────────────────────
// Feature 1: Returns a plain-English security explanation for a drift event
router_ai.post('/ai/explain', async (req, res) => {
  console.log('[POST /ai/explain] starts')
  try {
    const explanation = await explainDrift(req.body)
    res.json({ explanation })
    console.log('[POST /ai/explain] ends')
  } catch (err) {
    console.log('[POST /ai/explain] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── POST /api/ai/explain END ─────────────────────────────────────────────────
 
// ── POST /api/ai/severity START ──────────────────────────────────────────────
// Feature 2: Returns an AI-reclassified severity rating for a drift record
router_ai.post('/ai/severity', async (req, res) => {
  console.log('[POST /ai/severity] starts')
  try {
    const result = await reclassifySeverity(req.body)
    res.json(result || {})
    console.log('[POST /ai/severity] ends')
  } catch (err) {
    console.log('[POST /ai/severity] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── POST /api/ai/severity END ────────────────────────────────────────────────
 
// ── POST /api/ai/recommend START ─────────────────────────────────────────────
// Feature 3: Returns an AI remediation recommendation explaining what revert will do
router_ai.post('/ai/recommend', async (req, res) => {
  console.log('[POST /ai/recommend] starts')
  try {
    const recommendation = await getRemediationRecommendation(req.body)
    res.json({ recommendation })
    console.log('[POST /ai/recommend] ends')
  } catch (err) {
    console.log('[POST /ai/recommend] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── POST /api/ai/recommend END ───────────────────────────────────────────────
 
// ── GET /api/ai/anomalies START ──────────────────────────────────────────────
// Feature 5: Analyses the last 50 drift records to surface anomaly patterns
router_ai.get('/ai/anomalies', async (req, res) => {
  console.log('[GET /ai/anomalies] starts')
  const { subscriptionId } = req.query
  if (!subscriptionId) {
    console.log('[GET /ai/anomalies] ends — missing subscriptionId')
    return res.status(400).json({ error: 'subscriptionId required' })
  }
  try {
    const records   = await getDriftRecords({ subscriptionId, limit: 50 })
    const anomalies = await detectAnomalies(records)
    res.json({ anomalies })
    console.log('[GET /ai/anomalies] ends — found:', anomalies.length)
  } catch (err) {
    console.log('[GET /ai/anomalies] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── GET /api/ai/anomalies END ────────────────────────────────────────────────
 
module.exports = router_ai
 
 