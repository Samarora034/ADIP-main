const router = require('express').Router()
const { getResourceConfig } = require('../services/azureResourceService')

// Scan start — fetches live config, returns it with a scanId
router.post('/scan/start', async (req, res) => {
  const { subscriptionId, resourceGroupId, resourceId } = req.body
  if (!subscriptionId || !resourceGroupId) return res.status(400).json({ error: 'subscriptionId and resourceGroupId required' })
  const scanId = `scan-${Date.now()}`
  try {
    const config = await getResourceConfig(subscriptionId, resourceGroupId, resourceId || null)
    res.json({ scanId, status: 'complete', progress: 100, results: config })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/scan/:scanId/stop', (req, res) => res.json({ scanId: req.params.scanId, status: 'stopped' }))
router.get('/scan/:scanId/status', (req, res) => res.json({ scanId: req.params.scanId, status: 'complete', progress: 10 }))

module.exports = router
