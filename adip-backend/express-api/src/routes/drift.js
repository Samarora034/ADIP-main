const router = require('express').Router()
const { getDriftRecords } = require('../services/blobService')

router.get('/drift-events', async (req, res) => {
  const { subscriptionId, resourceGroup, severity, limit } = req.query
  if (!subscriptionId) return res.status(400).json({ error: 'subscriptionId required' })
  try {
    const records = await getDriftRecords({ subscriptionId, resourceGroup, severity, limit })
    res.json(records)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
