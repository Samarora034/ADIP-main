// ============================================================
// FILE: routes/drift.js
// ============================================================
const router_drift = require('express').Router()
const { getDriftRecords: getDriftRecordsForRoute } = require('../services/blobService')
 
// ── GET /api/drift-events START ──────────────────────────────────────────────
// Returns stored drift records filtered by subscription, resource group, and severity
router_drift.get('/drift-events', async (req, res) => {
  console.log('[GET /drift-events] starts')
  const { subscriptionId, resourceGroup, severity, limit } = req.query
  if (!subscriptionId) {
    console.log('[GET /drift-events] ends — missing subscriptionId')
    return res.status(400).json({ error: 'subscriptionId required' })
  }
  try {
    const records = await getDriftRecordsForRoute({ subscriptionId, resourceGroup, severity, limit })
    res.json(records)
    console.log('[GET /drift-events] ends — returned:', records.length)
  } catch (err) {
    console.log('[GET /drift-events] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── GET /api/drift-events END ────────────────────────────────────────────────
 
module.exports = router_drift
 
 