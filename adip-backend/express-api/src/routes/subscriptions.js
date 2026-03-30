const router = require('express').Router()
const { listSubscriptions } = require('../services/azureResourceService')

router.get('/subscriptions', async (req, res) => {
  try {
    const subs = await listSubscriptions()
    res.json(subs.map(s => ({ id: s.subscriptionId, name: s.displayName })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
