'use strict'
const router = require('express').Router()
const { diffObjects }      = require('../shared/diff')
const { classifySeverity } = require('../shared/severity')
const { getResourceConfig } = require('../services/azureResourceService')
const { getBaseline, saveDriftRecord } = require('../services/blobService')
const { broadcastDriftEvent } = require('../services/signalrService')
const { sendDriftAlert }   = require('../services/alertService')
const { explainDrift, reclassifySeverity } = require('../services/aiService')

<<<<<<< HEAD
const VOLATILE = ['etag', 'changedTime', 'createdTime', 'provisioningState', 'lastModifiedAt', 'systemData', '_ts', '_etag']
const CRITICAL_PATHS = ['properties.networkAcls', 'properties.accessPolicies', 'properties.securityRules', 'sku', 'location', 'identity', 'properties.encryption']

// Active monitoring sessions: key → intervalId
const monitoringSessions = {}


// ── strip START ──────────────────────────────────────────────────────────────
// Recursively removes volatile ARM fields before diffing to avoid false positives
function strip(obj) {
  console.log('[compare.strip] starts')
  if (Array.isArray(obj)) {
    const r = obj.map(strip)
    console.log('[compare.strip] ends — array')
    return r
  }
  if (obj && typeof obj === 'object') {
    const r = Object.fromEntries(
      Object.entries(obj).filter(([k]) => !VOLATILE.includes(k)).map(([k, v]) => [k, strip(v)])
    )
    console.log('[compare.strip] ends — object')
    return r
  }
  console.log('[compare.strip] ends — primitive')
  return obj
}
// ── strip END ────────────────────────────────────────────────────────────────


// ── classifySeverity START ───────────────────────────────────────────────────
// Classifies drift severity based on field type and security-sensitive path rules
function classifySeverity(differences) {
  console.log('[compare.classifySeverity] starts — differences count:', differences.length)
  if (!differences.length) {
    console.log('[compare.classifySeverity] ends — none')
    return 'none'
  }
  if (differences.some(d => d.kind === 'D')) {
    console.log('[compare.classifySeverity] ends — critical (deletion found)')
    return 'critical'
  }
  const tagChanges = differences.filter(d => d.path?.includes('tags'))
  if (tagChanges.length >= 3) {
    console.log('[compare.classifySeverity] ends — critical (3+ tag changes)')
    return 'critical'
  }
  if (differences.some(d => CRITICAL_PATHS.some(p => d.path?.join('.').startsWith(p)))) {
    console.log('[compare.classifySeverity] ends — high')
    return 'high'
  }
  if (differences.length > 5) {
    console.log('[compare.classifySeverity] ends — medium')
    return 'medium'
  }
  console.log('[compare.classifySeverity] ends — low')
  return 'low'
}
// ── classifySeverity END ─────────────────────────────────────────────────────
=======
const _sessions = {}
>>>>>>> 603e85ae615700dabfbeec3adeefee440674d11c


// ── runDriftCheck START ──────────────────────────────────────────────────────
// Full drift check pipeline: fetches live + baseline, diffs, classifies, runs AI, saves record, alerts
async function runDriftCheck(subscriptionId, resourceGroupId, resourceId) {
  console.log('[runDriftCheck] starts — subscriptionId:', subscriptionId, 'rg:', resourceGroupId, 'resourceId:', resourceId)
  const [liveRaw, baseline] = await Promise.all([
    getResourceConfig(subscriptionId, resourceGroupId, resourceId || null),
    getBaseline(subscriptionId, resourceId || resourceGroupId),
  ])

  const differences = baseline?.resourceState ? diffObjects(baseline.resourceState, liveRaw) : []
  const severity    = classifySeverity(differences)
  const record = {
    subscriptionId, resourceGroupId,
    resourceId: resourceId || null, resourceGroup: resourceGroupId,
    liveState: liveRaw, baselineState: baseline?.resourceState || null,
    differences, severity, changeCount: differences.length,
    detectedAt: new Date().toISOString(),
  }

  if (differences.length > 0) {
<<<<<<< HEAD
    const [aiExplanation, aiSeverity] = await Promise.all([
      explainDrift(record),
      reclassifySeverity(record),
    ]).catch(() => [null, null])

    if (aiExplanation) record.aiExplanation = aiExplanation
    if (aiSeverity) {
      record.aiSeverity  = aiSeverity.severity
      record.aiReasoning = aiSeverity.reasoning
=======
    const [aiExplanation, aiSeverity] = await Promise.allSettled([
      explainDrift(record), reclassifySeverity(record),
    ]).then(r => r.map(x => x.value ?? null))

    if (aiExplanation) record.aiExplanation = aiExplanation
    if (aiSeverity) {
      record.aiSeverity = aiSeverity.severity; record.aiReasoning = aiSeverity.reasoning
>>>>>>> 603e85ae615700dabfbeec3adeefee440674d11c
      const order = ['none','low','medium','high','critical']
      if (order.indexOf(aiSeverity.severity) > order.indexOf(record.severity)) record.severity = aiSeverity.severity
    }
    await saveDriftRecord(record)
    broadcastDriftEvent(record)
    sendDriftAlert(record).catch(() => {})
  }
  console.log('[runDriftCheck] ends — severity:', record.severity, 'changes:', differences.length)
  return record
}
// ── runDriftCheck END ────────────────────────────────────────────────────────

<<<<<<< HEAD

// ── POST /api/compare START ──────────────────────────────────────────────────
// Manual one-shot drift comparison: fetches live config, diffs against baseline, returns result
=======
>>>>>>> 603e85ae615700dabfbeec3adeefee440674d11c
router.post('/compare', async (req, res) => {
  console.log('[POST /compare] starts')
  const { subscriptionId, resourceGroupId, resourceId } = req.body
<<<<<<< HEAD
  if (!subscriptionId || !resourceGroupId) {
    console.log('[POST /compare] ends — missing required fields')
    return res.status(400).json({ error: 'subscriptionId and resourceGroupId required' })
  }
  try {
    const record = await runDriftCheck(subscriptionId, resourceGroupId, resourceId || null)
    res.json(record)
    console.log('[POST /compare] ends — severity:', record.severity)
  } catch (err) {
    console.log('[POST /compare] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── POST /api/compare END ────────────────────────────────────────────────────


// ── POST /api/monitor/start START ────────────────────────────────────────────
// Starts a server-side polling monitor that runs drift checks on a configurable interval
=======
  if (!subscriptionId || !resourceGroupId) return res.status(400).json({ error: 'subscriptionId and resourceGroupId required' })
  try { res.json(await runDriftCheck(subscriptionId, resourceGroupId, resourceId || null)) }
  catch (err) { res.status(500).json({ error: err.message }) }
})
>>>>>>> 603e85ae615700dabfbeec3adeefee440674d11c
router.post('/monitor/start', (req, res) => {
  console.log('[POST /monitor/start] starts')
  const { subscriptionId, resourceGroupId, resourceId, intervalMs = 30000 } = req.body
<<<<<<< HEAD
  if (!subscriptionId || !resourceGroupId) {
    console.log('[POST /monitor/start] ends — missing required fields')
    return res.status(400).json({ error: 'subscriptionId and resourceGroupId required' })
  }

  const key = `${subscriptionId}:${resourceGroupId}:${resourceId || ''}`
  if (monitoringSessions[key]) clearInterval(monitoringSessions[key])

  monitoringSessions[key] = setInterval(async () => {
    try { await runDriftCheck(subscriptionId, resourceGroupId, resourceId || null) } catch (_) {}
  }, Math.max(intervalMs, 15000))

  res.json({ monitoring: true, key, intervalMs })
  console.log('[POST /monitor/start] ends — key:', key, 'intervalMs:', intervalMs)
=======
  if (!subscriptionId || !resourceGroupId) return res.status(400).json({ error: 'subscriptionId and resourceGroupId required' })
  const key = `${subscriptionId}:${resourceGroupId}:${resourceId || ''}`
  if (_sessions[key]) clearInterval(_sessions[key])
  _sessions[key] = setInterval(() => runDriftCheck(subscriptionId, resourceGroupId, resourceId || null).catch(() => {}), Math.max(Number(intervalMs), 15000))
  res.json({ monitoring: true, key })
>>>>>>> 603e85ae615700dabfbeec3adeefee440674d11c
})
// ── POST /api/monitor/start END ──────────────────────────────────────────────

<<<<<<< HEAD

// ── POST /api/monitor/stop START ─────────────────────────────────────────────
// Stops a running server-side monitor session
=======
>>>>>>> 603e85ae615700dabfbeec3adeefee440674d11c
router.post('/monitor/stop', (req, res) => {
  console.log('[POST /monitor/stop] starts')
  const { subscriptionId, resourceGroupId, resourceId } = req.body
  const key = `${subscriptionId}:${resourceGroupId}:${resourceId || ''}`
  if (_sessions[key]) { clearInterval(_sessions[key]); delete _sessions[key] }
  res.json({ monitoring: false, key })
  console.log('[POST /monitor/stop] ends — key:', key)
})
// ── POST /api/monitor/stop END ───────────────────────────────────────────────

module.exports = router