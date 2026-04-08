// ============================================================
// FILE: routes/baseline.js
// ============================================================
const router_baseline = require('express').Router()
const { getBaseline, saveBaseline } = require('../services/blobService')
 
// ── GET /api/baselines START ─────────────────────────────────────────────────
// Returns the active golden baseline for a given resource
router_baseline.get('/baselines', async (req, res) => {
  console.log('[GET /baselines] starts')
  const { subscriptionId, resourceId } = req.query
  if (!subscriptionId) {
    console.log('[GET /baselines] ends — missing subscriptionId')
    return res.status(400).json({ error: 'subscriptionId required' })
  }
  try {
    const baseline = await getBaseline(subscriptionId, resourceId)
    res.json(baseline || null)
    console.log('[GET /baselines] ends')
  } catch (err) {
    console.log('[GET /baselines] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── GET /api/baselines END ───────────────────────────────────────────────────
 
// ── POST /api/baselines START ────────────────────────────────────────────────
// Saves a new golden baseline for a resource
router_baseline.post('/baselines', async (req, res) => {
  console.log('[POST /baselines] starts')
  const { subscriptionId, resourceGroupId, resourceId, resourceState } = req.body
  if (!subscriptionId || !resourceState) {
    console.log('[POST /baselines] ends — missing required fields')
    return res.status(400).json({ error: 'subscriptionId and resourceState required' })
  }
  try {
    const saved = await saveBaseline(subscriptionId, resourceGroupId, resourceId, resourceState)
    res.json(saved)
    console.log('[POST /baselines] ends')
  } catch (err) {
    console.log('[POST /baselines] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── POST /api/baselines END ──────────────────────────────────────────────────
 
module.exports = router_baseline
 