// ============================================================
// FILE: routes/seed.js
// ============================================================
const router_seed = require('express').Router()
const { saveBaseline: saveBaselineForSeed } = require('../services/blobService')
const { getResourceConfig: getResourceConfigForSeed } = require('../services/azureResourceService')
 
// ── POST /api/seed-baseline START ────────────────────────────────────────────
// Seeds the golden baseline from the current live ARM config (no hardcoded data)
router_seed.post('/seed-baseline', async (req, res) => {
  console.log('[POST /seed-baseline] starts')
  const { subscriptionId, resourceGroupId, resourceId } = req.body
  if (!subscriptionId || !resourceGroupId || !resourceId) {
    console.log('[POST /seed-baseline] ends — missing required fields')
    return res.status(400).json({ error: 'subscriptionId, resourceGroupId and resourceId required' })
  }
  try {
    const liveConfig = await getResourceConfigForSeed(subscriptionId, resourceGroupId, resourceId)
    const saved = await saveBaselineForSeed(subscriptionId, resourceGroupId, resourceId, liveConfig)
    res.json({ message: 'Golden baseline seeded from live config', baseline: saved })
    console.log('[POST /seed-baseline] ends — resourceId:', resourceId)
  } catch (err) {
    console.log('[POST /seed-baseline] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── POST /api/seed-baseline END ──────────────────────────────────────────────
 
module.exports = router_seed
 
 