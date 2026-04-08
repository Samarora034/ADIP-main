require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') })
const { ResourceManagementClient } = require('@azure/arm-resources')
const { DefaultAzureCredential }   = require('@azure/identity')
const { BlobServiceClient } = require('@azure/storage-blob')
const { EmailClient }       = require('@azure/communication-email')
const fetch                 = require('node-fetch')

// ── Blob Storage — initialised once at module load ────────────────────────────
const blobService = BlobServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING)
const baselineCtr = blobService.getContainerClient('baselines')
const driftCtr    = blobService.getContainerClient('drift-records')


// ── blobKey START ────────────────────────────────────────────────────────────
// Converts a resourceId to a URL-safe blob name using base64url encoding
function blobKey(resourceId) {
  console.log('[detectDrift.blobKey] starts')
  const key = Buffer.from(resourceId).toString('base64url') + '.json'
  console.log('[detectDrift.blobKey] ends')
  return key
}
// ── blobKey END ──────────────────────────────────────────────────────────────


// ── driftKey START ───────────────────────────────────────────────────────────
// Creates a timestamp-prefixed drift record blob name for chronological listing
function driftKey(resourceId, ts) {
  console.log('[detectDrift.driftKey] starts')
  const key = `${(ts||new Date().toISOString()).replace(/[:.]/g,'-')}_${Buffer.from(resourceId).toString('base64url')}.json`
  console.log('[detectDrift.driftKey] ends')
  return key
}
// ── driftKey END ─────────────────────────────────────────────────────────────


// ── readBlob START ───────────────────────────────────────────────────────────
// Downloads and JSON-parses a blob; returns null if the blob does not exist
async function readBlob(ctr, name) {
  console.log('[detectDrift.readBlob] starts — blob:', name)
  try {
    const buf = await ctr.getBlobClient(name).downloadToBuffer()
    const result = JSON.parse(buf.toString())
    console.log('[detectDrift.readBlob] ends')
    return result
  } catch(e) {
    if(e.statusCode===404||e.code==='BlobNotFound') {
      console.log('[detectDrift.readBlob] ends — not found')
      return null
    }
    console.log('[detectDrift.readBlob] ends — unexpected error:', e.message)
    throw e
  }
}
// ── readBlob END ─────────────────────────────────────────────────────────────


const VOLATILE       = ['etag','changedTime','createdTime','provisioningState','lastModifiedAt','systemData','_ts','_etag','primaryEndpoints','secondaryEndpoints','primaryLocation','secondaryLocation','statusOfPrimary','statusOfSecondary','creationTime']
const CRITICAL_PATHS = ['properties.networkAcls','properties.accessPolicies','properties.securityRules','sku','location','identity','properties.encryption']

const API_VERSION_MAP = {
  storageaccounts:'2023-01-01', virtualmachines:'2023-07-01', workflows:'2019-05-01',
  sites:'2023-01-01', vaults:'2023-07-01', virtualnetworks:'2023-05-01',
  networksecuritygroups:'2023-05-01', databaseaccounts:'2024-11-15',
  accounts:'2023-11-01', components:'2020-02-02',
}


// ── strip START ──────────────────────────────────────────────────────────────
// Recursively removes volatile ARM fields to prevent false-positive diffs
function strip(obj) {
  console.log('[detectDrift.strip] starts')
  if (obj === null || obj === undefined) {
    console.log('[detectDrift.strip] ends — null/undefined')
    return obj
  }
  if (Array.isArray(obj)) {
    const r = obj.map(strip)
    console.log('[detectDrift.strip] ends — array')
    return r
  }
  if (typeof obj === 'object') {
    const r = Object.fromEntries(
      Object.entries(obj).filter(([k]) => !VOLATILE.includes(k)).map(([k,v]) => [k, strip(v)])
    )
    console.log('[detectDrift.strip] ends — object')
    return r
  }
  console.log('[detectDrift.strip] ends — primitive')
  return obj
}
// ── strip END ────────────────────────────────────────────────────────────────


// ── classifySeverity START ───────────────────────────────────────────────────
// Classifies drift severity using deletion, security-path, tag-count, and field-count rules
function classifySeverity(diffs) {
  console.log('[detectDrift.classifySeverity] starts — diffs count:', diffs.length)
  if (!diffs.length) {
    console.log('[detectDrift.classifySeverity] ends — none')
    return 'none'
  }
  if (diffs.some(d => d.type === 'removed')) {
    console.log('[detectDrift.classifySeverity] ends — critical (removal)')
    return 'critical'
  }
  const tagChanges = diffs.filter(d => d.path.includes('tags'))
  if (tagChanges.length >= 3) {
    console.log('[detectDrift.classifySeverity] ends — critical (3+ tag changes)')
    return 'critical'
  }
  if (diffs.some(d => CRITICAL_PATHS.some(p => d.path.startsWith(p)))) {
    console.log('[detectDrift.classifySeverity] ends — high')
    return 'high'
  }
  if (diffs.length > 5) {
    console.log('[detectDrift.classifySeverity] ends — medium')
    return 'medium'
  }
  console.log('[detectDrift.classifySeverity] ends — low')
  return 'low'
}
// ── classifySeverity END ─────────────────────────────────────────────────────


// ── safeStr START ────────────────────────────────────────────────────────────
// Converts any value to a string safely for use in human-readable diff sentences
function safeStr(val) {
  console.log('[detectDrift.safeStr] starts')
  let result
  if (val === null || val === undefined) result = 'null'
  else if (typeof val === 'object') result = JSON.stringify(val)
  else result = String(val)
  console.log('[detectDrift.safeStr] ends')
  return result
}
// ── safeStr END ──────────────────────────────────────────────────────────────


// ── computeDiff START ────────────────────────────────────────────────────────
// Recursive diff engine that detects added, removed, modified, and array changes
function computeDiff(prev, curr, path, results) {
  console.log('[detectDrift.computeDiff] starts — path:', path)
  if (prev === null || prev === undefined) {
    if (curr !== null && curr !== undefined) {
      if (typeof curr === 'object' && !Array.isArray(curr)) {
        for (const k of Object.keys(curr)) {
          computeDiff(undefined, curr[k], `${path} → ${k}`, results)
        }
      } else {
        results.push({ path, type: 'added', oldValue: null, newValue: curr,
          sentence: `added "${path.split(' → ').pop()}" = ${safeStr(curr)}` })
      }
    }
    console.log('[detectDrift.computeDiff] ends — prev null/undefined')
    return
  }
  if (curr === null || curr === undefined) {
    results.push({ path, type: 'removed', oldValue: prev, newValue: null,
      sentence: `removed "${path.split(' → ').pop()}" (was ${safeStr(prev)})` })
    console.log('[detectDrift.computeDiff] ends — curr null/undefined (removed)')
    return
  }

  if (Array.isArray(prev) && Array.isArray(curr)) {
    const stableStr = (v) => JSON.stringify(v, Object.keys(v || {}).sort())
    const normArr = (a) => JSON.stringify(a.map(i => typeof i === 'object' && i ? stableStr(i) : i).sort())
    if (normArr(prev) !== normArr(curr)) {
      const added   = curr.filter(c => !prev.some(p => JSON.stringify(p) === JSON.stringify(c)))
      const removed = prev.filter(p => !curr.some(c => JSON.stringify(c) === JSON.stringify(p)))
      if (added.length > 0)
        results.push({ path, type: 'array-added', oldValue: prev, newValue: curr,
          sentence: `added ${added.length} item(s) to "${path.split(' → ').pop()}"` })
      if (removed.length > 0)
        results.push({ path, type: 'array-removed', oldValue: prev, newValue: curr,
          sentence: `removed ${removed.length} item(s) from "${path.split(' → ').pop()}"` })
      if (added.length === 0 && removed.length === 0)
        results.push({ path, type: 'array-reordered', oldValue: prev, newValue: curr,
          sentence: `reordered items in "${path.split(' → ').pop()}"` })
    }
    console.log('[detectDrift.computeDiff] ends — arrays compared')
    return
  }

  if (typeof prev === 'object' && typeof curr === 'object') {
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)])
    for (const k of allKeys) {
      computeDiff(prev[k], curr[k], path ? `${path} → ${k}` : k, results)
    }
    console.log('[detectDrift.computeDiff] ends — objects recursed')
    return
  }

  if (prev !== curr) {
    const field = path.split(' → ').pop()
    const isTag = path.includes('tags')
    results.push({
      path, type: 'modified', oldValue: prev, newValue: curr,
      sentence: isTag
        ? `changed tag '${field}' from "${prev}" to "${curr}"`
        : `changed "${field}" from "${safeStr(prev)}" to "${safeStr(curr)}"`,
    })
  }
  console.log('[detectDrift.computeDiff] ends — primitives compared')
}
// ── computeDiff END ──────────────────────────────────────────────────────────


// ── normalize START ──────────────────────────────────────────────────────────
// Flattens _childConfig into the top-level to ensure baselines diff cleanly against enriched live state
function normalize(obj) {
  console.log('[detectDrift.normalize] starts')
  if (!obj || typeof obj !== 'object') {
    console.log('[detectDrift.normalize] ends — not an object')
    return obj
  }
  const { _childConfig, ...rest } = obj
  if (_childConfig) Object.entries(_childConfig).forEach(([k, v]) => { rest[k] = v })
  console.log('[detectDrift.normalize] ends')
  return rest
}
// ── normalize END ────────────────────────────────────────────────────────────


// ── diffObjects START ────────────────────────────────────────────────────────
// Runs the full diff pipeline: normalise → computeDiff → filter empty paths
function diffObjects(prev, curr) {
  console.log('[detectDrift.diffObjects] starts')
  const results = []
  computeDiff(normalize(prev), normalize(curr), '', results)
  const filtered = results.filter(r => r.path !== '')
  console.log('[detectDrift.diffObjects] ends — changes:', filtered.length)
  return filtered
}
// ── diffObjects END ──────────────────────────────────────────────────────────


// ── sendAlertEmail START ─────────────────────────────────────────────────────
// Sends a drift alert email directly from the Function App (bypasses Express for critical/high)
async function sendAlertEmail(record) {
  console.log('[detectDrift.sendAlertEmail] starts — severity:', record.severity)
  const connStr    = process.env.COMMS_CONNECTION_STRING
  const recipients = (process.env.ALERT_RECIPIENT_EMAIL || '').split(',').map(e => e.trim()).filter(Boolean)
  if (!connStr || !recipients.length || !['critical', 'high'].includes(record.severity)) {
    console.log('[detectDrift.sendAlertEmail] ends — skipped')
    return
  }
  try {
    const client       = new EmailClient(connStr)
    const resourceName = record.resourceId?.split('/').pop() ?? record.resourceId
    const changes      = (record.differences || []).slice(0, 10).map(c => `- ${c.sentence || c.path}`).join('\n')
    const baseUrl      = process.env.EXPRESS_PUBLIC_URL || 'http://localhost:3001'
    const token        = Buffer.from(JSON.stringify({
      resourceId: record.resourceId, resourceGroup: record.resourceGroup,
      subscriptionId: record.subscriptionId, detectedAt: record.detectedAt,
    })).toString('base64url')
    const approveUrl = `${baseUrl}/api/remediate-decision?action=approve&token=${token}`
    const rejectUrl  = `${baseUrl}/api/remediate-decision?action=reject&token=${token}`
    const color      = record.severity === 'critical' ? '#dc2626' : '#d97706'
    const poller = await client.beginSend({
      senderAddress: process.env.SENDER_ADDRESS,
      recipients:    { to: recipients.map(address => ({ address })) },
      content: {
        subject:   `[ADIP] ${record.severity.toUpperCase()} Drift - ${resourceName} - Action Required`,
        html:      `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden"><div style="background:${color};padding:20px 24px"><h2 style="color:#fff;margin:0">Azure Drift Alert - ${record.severity.toUpperCase()}</h2></div><div style="padding:24px"><p><strong>Resource:</strong> ${resourceName}</p><p><strong>Group:</strong> ${record.resourceGroup}</p><p><strong>Changes:</strong> ${record.differences?.length || 0}</p><pre style="background:#f9fafb;padding:12px;font-size:12px">${changes}</pre><div style="margin-top:20px"><a href="${approveUrl}" style="padding:10px 20px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;margin-right:12px">Approve Remediation</a><a href="${rejectUrl}" style="padding:10px 20px;background:#6b7280;color:#fff;text-decoration:none;border-radius:6px">Reject</a></div></div></div>`,
        plainText: `ADIP Drift Alert\nSeverity: ${record.severity.toUpperCase()}\nResource: ${resourceName}\nChanges: ${record.differences?.length || 0}\n\n${changes}`,
      },
    })
    await poller.pollUntilDone()
    console.log('[detectDrift.sendAlertEmail] ends — email sent to:', recipients.join(', '))
  } catch (_) {
    console.log('[detectDrift.sendAlertEmail] ends — email failed (non-fatal)')
  }
}
// ── sendAlertEmail END ───────────────────────────────────────────────────────


// ── Main handler START ───────────────────────────────────────────────────────
// Azure Function entry point: validates input, fetches live config, diffs, stores record, alerts
module.exports = async function (context, req) {
  console.log('[detectDrift main handler] starts')
  const body = req.body

  // Event Grid validation handshake
  if (Array.isArray(body) && body[0]?.eventType === 'Microsoft.EventGrid.SubscriptionValidationEvent') {
    context.res = { status: 200, body: { validationResponse: body[0].data.validationCode } }
    console.log('[detectDrift main handler] ends — validation handshake')
    return
  }

  const eventData = Array.isArray(body) ? body[0]?.data : body
  const { resourceId, subscriptionId } = eventData || {}
  if (!resourceId || !subscriptionId) {
    context.res = { status: 400, body: { error: 'resourceId and subscriptionId required' } }
    console.log('[detectDrift main handler] ends — missing required fields')
    return
  }

  try {
    const credential = new DefaultAzureCredential()
    const armClient  = new ResourceManagementClient(credential, subscriptionId)
    const parts      = resourceId.split('/')
    const rgName     = parts[4] || ''
    const provider   = parts[6] || ''
    const type       = parts[7] || ''
    const name       = parts[8] || ''

    if (!rgName || !provider || !type || !name) {
      context.res = { status: 400, body: { error: 'Invalid resourceId: ' + resourceId } }
      console.log('[detectDrift main handler] ends — invalid resourceId')
      return
    }

    const apiVersion = API_VERSION_MAP[type.toLowerCase()] || '2021-04-01'

    const liveRaw = await armClient.resources.get(rgName, provider, '', type, name, apiVersion)
    const live    = strip(liveRaw)

    const baseline = await readBlob(baselineCtr, blobKey(resourceId))

    const baseState = baseline ? strip(baseline.resourceState) : null
    const changes   = baseState ? diffObjects(baseState, live) : []
    const severity  = classifySeverity(changes)

    if (changes.length === 0) {
      context.res = { status: 200, body: { drifted: false, changeCount: 0 } }
      console.log('[detectDrift main handler] ends — no drift detected')
      return
    }

    const detectedAt = new Date().toISOString()
    const record = {
      subscriptionId, resourceId,
      resourceGroup: rgName,
      liveState:     live,
      baselineState: baseState,
      differences:   changes,
      severity,
      changeCount:   changes.length,
      detectedAt,
    }

    const driftBody = JSON.stringify(record)
    await driftCtr.getBlockBlobClient(driftKey(resourceId, detectedAt))
      .upload(driftBody, Buffer.byteLength(driftBody), { blobHTTPHeaders: { blobContentType: 'application/json' } })

    sendAlertEmail(record).catch(() => {})

    const apiUrl = process.env.EXPRESS_API_URL
    if (apiUrl) {
      await fetch(`${apiUrl}/internal/drift-event`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      }).catch(() => {})
    }

    context.res = { status: 200, body: { drifted: true, ...record } }
    console.log('[detectDrift main handler] ends — drift detected, severity:', severity, 'changes:', changes.length)
  } catch (err) {
    context.log.error('detectDrift error:', err.message)
    context.res = { status: 500, body: { error: err.message } }
    console.log('[detectDrift main handler] ends — error:', err.message)
  }
}
// ── Main handler END ─────────────────────────────────────────────────────────