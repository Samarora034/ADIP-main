const router = require('express').Router()
const { listResourceGroups } = require('../services/azureResourceService')

router.get('/subscriptions/:subscriptionId/resource-groups', async (req, res) => {
  try {
    const rgs = await listResourceGroups(req.params.subscriptionId)
    res.json(rgs.map(rg => ({ id: rg.name, name: rg.name, location: rg.location })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
