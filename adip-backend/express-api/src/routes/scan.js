// ============================================================
// FILE: routes/scan.js
// ============================================================
const router_scan = require('express').Router()
const { getResourceConfig: getResourceConfigForScan } = require('../services/azureResourceService')
 
// ── POST /api/scan/start START ───────────────────────────────────────────────
// Fetches the live resource config and returns it with a scanId
router_scan.post('/scan/start', async (req, res) => {
  console.log('[POST /scan/start] starts')
  const { subscriptionId, resourceGroupId, resourceId } = req.body
  if (!subscriptionId || !resourceGroupId) {
    console.log('[POST /scan/start] ends — missing required fields')
    return res.status(400).json({ error: 'subscriptionId and resourceGroupId required' })
  }
  const scanId = `scan-${Date.now()}`
  try {
    const config = await getResourceConfigForScan(subscriptionId, resourceGroupId, resourceId || null)
    res.json({ scanId, status: 'complete', progress: 100, results: config })
    console.log('[POST /scan/start] ends — scanId:', scanId)
  } catch (err) {
    console.log('[POST /scan/start] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── POST /api/scan/start END ─────────────────────────────────────────────────
 
// ── POST /api/scan/:scanId/stop START ────────────────────────────────────────
// Acknowledges a stop request for an in-progress scan
router_scan.post('/scan/:scanId/stop', (req, res) => {
  console.log('[POST /scan/:scanId/stop] starts — scanId:', req.params.scanId)
  res.json({ scanId: req.params.scanId, status: 'stopped' })
  console.log('[POST /scan/:scanId/stop] ends')
})
// ── POST /api/scan/:scanId/stop END ──────────────────────────────────────────
 
// ── GET /api/scan/:scanId/status START ───────────────────────────────────────
// Returns the status of a scan (always complete for this synchronous implementation)
router_scan.get('/scan/:scanId/status', (req, res) => {
  console.log('[GET /scan/:scanId/status] starts — scanId:', req.params.scanId)
  res.json({ scanId: req.params.scanId, status: 'complete', progress: 100 })
  console.log('[GET /scan/:scanId/status] ends')
})
// ── GET /api/scan/:scanId/status END ─────────────────────────────────────────
 
module.exports = router_scan
 
 