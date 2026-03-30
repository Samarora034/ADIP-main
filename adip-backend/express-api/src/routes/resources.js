const router = require('express').Router()
const { listResources } = require('../services/azureResourceService')

router.get('/subscriptions/:subscriptionId/resource-groups/:resourceGroupId/resources', async (req, res) => {
  try {
    const resources = await listResources(req.params.subscriptionId, req.params.resourceGroupId)
    res.json(resources.map(r => ({ id: r.id, name: r.name, type: r.type })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
