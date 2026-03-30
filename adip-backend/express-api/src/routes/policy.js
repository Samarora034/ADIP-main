const router = require('express').Router()
const { getPolicyCompliance } = require('../services/policyService')

// GET /api/policy/compliance?subscriptionId=&resourceGroupId=&resourceId=
router.get('/policy/compliance', async (req, res) => {
  const { subscriptionId, resourceGroupId, resourceId } = req.query
  if (!subscriptionId || !resourceGroupId)
    return res.status(400).json({ error: 'subscriptionId and resourceGroupId required' })
  try {
    const result = await getPolicyCompliance(subscriptionId, resourceGroupId, resourceId || null)
    res.json(result)
  } catch (err) {
    // Policy Insights may return empty if no policies assigned — treat as compliant
    if (err.statusCode === 404 || err.code === 'ResourceNotFound') {
      return res.json({ total: 0, nonCompliant: 0, compliant: 0, summary: 'no-policies', violations: [] })
    }
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
