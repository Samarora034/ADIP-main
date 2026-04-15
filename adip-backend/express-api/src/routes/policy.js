// ============================================================
// FILE: routes/policy.js
// ============================================================
const router_policy = require('express').Router()
const { getPolicyCompliance } = require('../services/policyService')
 
// ── GET /api/policy/compliance START ─────────────────────────────────────────
// Returns Azure Policy compliance state for a resource or resource group (read-only)
router_policy.get('/policy/compliance', async (req, res) => {
  console.log('[GET /policy/compliance] starts')
  const { subscriptionId, resourceGroupId, resourceId } = req.query
  if (!subscriptionId || !resourceGroupId) {
    console.log('[GET /policy/compliance] ends — missing required params')
    return res.status(400).json({ error: 'subscriptionId and resourceGroupId required' })
  }
  try {
    const result = await getPolicyCompliance(subscriptionId, resourceGroupId, resourceId || null)
    res.json(result)
    console.log('[GET /policy/compliance] ends')
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ResourceNotFound') {
      console.log('[GET /policy/compliance] ends — no policies assigned')
      return res.json({ total: 0, nonCompliant: 0, compliant: 0, summary: 'no-policies', violations: [] })
    }
    console.log('[GET /policy/compliance] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── GET /api/policy/compliance END ───────────────────────────────────────────
 
module.exports = router_policy
 
 