// ============================================================
// FILE: routes/remediateRequest.js
// ============================================================
const router_remediateRequest = require('express').Router()
const { sendDriftAlert: sendDriftAlertForRequest } = require('../services/alertService')
 
// ── POST /api/remediate-request START ────────────────────────────────────────
// Sends a drift approval email to admins without applying remediation; waits for email click
router_remediateRequest.post('/remediate-request', async (req, res) => {
  console.log('[POST /remediate-request] starts')
  const { subscriptionId, resourceGroupId, resourceId, differences, changes, severity, caller } = req.body
  if (!subscriptionId || !resourceId) {
    console.log('[POST /remediate-request] ends — missing required fields')
    return res.status(400).json({ error: 'subscriptionId and resourceId required' })
  }
 
  try {
    await sendDriftAlertForRequest({
      subscriptionId,
      resourceGroup: resourceGroupId,
      resourceId,
      severity:      severity || 'high',
      changeCount:   differences?.length || changes?.length || 0,
      differences:   differences || changes || [],
      changes:       changes || differences || [],
      caller:        caller || 'unknown',
      detectedAt:    new Date().toISOString(),
    })
    res.json({ requested: true, message: 'Approval email sent to administrators.' })
    console.log('[POST /remediate-request] ends — email sent')
  } catch (err) {
    console.log('[POST /remediate-request] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── POST /api/remediate-request END ──────────────────────────────────────────
 
module.exports = router_remediateRequest
 