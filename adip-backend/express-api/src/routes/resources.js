// ============================================================
// FILE: routes/resources.js
// ============================================================
const router_resources = require('express').Router()
const { listResources } = require('../services/azureResourceService')
 
// ── GET /api/subscriptions/:id/resource-groups/:rg/resources START ───────────
// Lists all resources in the given resource group
router_resources.get('/subscriptions/:subscriptionId/resource-groups/:resourceGroupId/resources', async (req, res) => {
  console.log('[GET /.../resources] starts — rg:', req.params.resourceGroupId)
  try {
    const resources = await listResources(req.params.subscriptionId, req.params.resourceGroupId)
    res.json(resources.map(r => ({ id: r.id, name: r.name, type: r.type })))
    console.log('[GET /.../resources] ends — returned:', resources.length)
  } catch (err) {
    console.log('[GET /.../resources] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── GET /api/subscriptions/:id/resource-groups/:rg/resources END ─────────────
 
module.exports = router_resources
 
 