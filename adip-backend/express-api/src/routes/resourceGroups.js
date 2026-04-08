// ============================================================
// FILE: routes/resourceGroups.js
// ============================================================
const router_resourceGroups = require('express').Router()
const { listResourceGroups } = require('../services/azureResourceService')
 
// ── GET /api/subscriptions/:id/resource-groups START ─────────────────────────
// Lists all resource groups in the given subscription
router_resourceGroups.get('/subscriptions/:subscriptionId/resource-groups', async (req, res) => {
  console.log('[GET /subscriptions/:id/resource-groups] starts — subscriptionId:', req.params.subscriptionId)
  try {
    const rgs = await listResourceGroups(req.params.subscriptionId)
    res.json(rgs.map(rg => ({ id: rg.name, name: rg.name, location: rg.location })))
    console.log('[GET /subscriptions/:id/resource-groups] ends — returned:', rgs.length)
  } catch (err) {
    console.log('[GET /subscriptions/:id/resource-groups] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── GET /api/subscriptions/:id/resource-groups END ───────────────────────────
 
module.exports = router_resourceGroups
 