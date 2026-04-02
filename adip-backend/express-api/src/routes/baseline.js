const router = require('express').Router()
const { getBaseline, saveBaseline } = require('../services/blobService')

router.get('/baselines', async (req, res) => {
  const { subscriptionId, resourceId } = req.query
  if (!subscriptionId) return res.status(400).json({ error: 'subscriptionId required' })
  try {
    const baseline = await getBaseline(subscriptionId, resourceId)
    res.json(baseline || null)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/baselines', async (req, res) => {
  const { subscriptionId, resourceGroupId, resourceId, resourceState } = req.body
  if (!subscriptionId || !resourceState) return res.status(400).json({ error: 'subscriptionId and resourceState required' })
  try {
    const saved = await saveBaseline(subscriptionId, resourceGroupId, resourceId, resourceState)
    res.json(saved)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
