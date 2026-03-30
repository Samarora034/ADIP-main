const router = require('express').Router()
const { getResourceConfig } = require('../services/azureResourceService')

router.get('/configuration', async (req, res) => {
  const { subscriptionId, resourceGroupId, resourceId } = req.query
  if (!subscriptionId || !resourceGroupId) return res.status(400).json({ error: 'subscriptionId and resourceGroupId required' })
  try {
    const config = await getResourceConfig(subscriptionId, resourceGroupId, resourceId || null)
    res.json(config)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
