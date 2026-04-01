require('dotenv').config()
const { ResourceManagementClient } = require('@azure/arm-resources')
const { DefaultAzureCredential }   = require('@azure/identity')
const { CosmosClient }             = require('@azure/cosmos')
const fetch                        = require('node-fetch')

// ── Cosmos DB — initialised once at module load (warm reuse across invocations) ──
const cosmos          = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY })
const db              = cosmos.database(process.env.COSMOS_DB || 'adip-db')
const driftContainer  = db.container(process.env.COSMOS_CONTAINER_DRIFT    || 'drift-records')
const baselineContainer = db.container(process.env.COSMOS_CONTAINER_BASELINE || 'baselines')

const VOLATILE       = ['etag','changedTime','createdTime','provisioningState','lastModifiedAt','systemData','_ts','_etag']
const CRITICAL_PATHS = ['properties.networkAcls','properties.accessPolicies','properties.securityRules','sku','location','identity','properties.encryption']

const API_VERSION_MAP = {
  storageaccounts:'2023-01-01', virtualmachines:'2023-07-01', workflows:'2019-05-01',
  sites:'2023-01-01', vaults:'2023-07-01', virtualnetworks:'2023-05-01',
  networksecuritygroups:'2023-05-01', databaseaccounts:'2024-11-15',
  accounts:'2023-11-01', components:'2020-02-02',
}

function strip(obj) {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(strip)
  if (typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).filter(([k]) => !VOLATILE.includes(k)).map(([k,v]) => [k, strip(v)]))
  return obj
}

function classifySeverity(diffs) {
  if (!diffs.length) return 'none'
  if (diffs.some(d => d.type === 'removed')) return 'critical'
  if (diffs.some(d => CRITICAL_PATHS.some(p => d.path.startsWith(p)))) return 'high'
  if (diffs.length > 5) return 'medium'
  return 'low'
}

// ── Task 2: Hardened recursive diff engine ────────────────────────────────────
// Replaces deep-diff library — handles nested objects, arrays, null transitions
function safeStr(val) {
  if (val === null || val === undefined) return 'null'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function computeDiff(prev, curr, path, results) {
  // Task 2c: Null/undefined safe traversal
  if (prev === null || prev === undefined) {
    if (curr !== null && curr !== undefined) {
      // Task 2a: Recursively expand new nested objects instead of [object Object]
      if (typeof curr === 'object' && !Array.isArray(curr)) {
        for (const k of Object.keys(curr)) {
          computeDiff(undefined, curr[k], `${path} → ${k}`, results)
        }
      } else {
        results.push({ path, type: 'added', oldValue: null, newValue: curr,
          sentence: `added "${path.split(' → ').pop()}" = ${safeStr(curr)}` })
      }
    }
    return
  }
  if (curr === null || curr === undefined) {
    results.push({ path, type: 'removed', oldValue: prev, newValue: null,
      sentence: `removed "${path.split(' → ').pop()}" (was ${safeStr(prev)})` })
    return
  }

  // Task 2b: Array handling — detect push vs full replacement
  if (Array.isArray(prev) && Array.isArray(curr)) {
    if (JSON.stringify(prev) !== JSON.stringify(curr)) {
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
    return
  }

  // Task 2a: Recurse into nested objects
  if (typeof prev === 'object' && typeof curr === 'object') {
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)])
    for (const k of allKeys) {
      computeDiff(prev[k], curr[k], path ? `${path} → ${k}` : k, results)
    }
    return
  }

  // Primitive comparison
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
}

function diffObjects(prev, curr) {
  const results = []
  computeDiff(prev, curr, '', results)
  return results.filter(r => r.path !== '')
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async function (context, req) {
  const body = req.body

  // Event Grid validation handshake
  if (Array.isArray(body) && body[0]?.eventType === 'Microsoft.EventGrid.SubscriptionValidationEvent') {
    context.res = { status: 200, body: { validationResponse: body[0].data.validationCode } }
    return
  }

  const eventData = Array.isArray(body) ? body[0]?.data : body
  const { resourceId, subscriptionId } = eventData || {}
  if (!resourceId || !subscriptionId) {
    context.res = { status: 400, body: { error: 'resourceId and subscriptionId required' } }
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
      return
    }

    const apiVersion = API_VERSION_MAP[type.toLowerCase()] || '2021-04-01'

    // Fetch live config from ARM
    const liveRaw = await armClient.resources.get(rgName, provider, '', type, name, apiVersion)
    const live    = strip(liveRaw)

    // ── Task 3: Point Read (1 RU) instead of query ────────────────────────────
    // Requires knowing the document id. We store baselines with a deterministic id.
    // Fall back to query only if point read misses.
    let baseline = null
    const pointId = `baseline-active-${Buffer.from(resourceId).toString('base64').replace(/[/+=]/g,'_')}`
    try {
      const { resource } = await baselineContainer.item(pointId, resourceId).read()
      baseline = resource || null
    } catch {
      // Point read missed — fall back to query (costs ~2.5 RU, happens once per new resource)
      const { resources } = await baselineContainer.items.query({
        query: 'SELECT TOP 1 * FROM c WHERE c.resourceId = @rid AND c.active = true ORDER BY c._ts DESC',
        parameters: [{ name: '@rid', value: resourceId }],
      }).fetchAll()
      baseline = resources[0] || null
    }

    // ── Task 2: Use hardened diff engine ─────────────────────────────────────
    const baseState = baseline ? strip(baseline.resourceState) : null
    const changes   = baseState ? diffObjects(baseState, live) : []
    const severity  = classifySeverity(changes)

    // ── Task 3: Only write to Cosmos DB if true delta detected ────────────────
    if (changes.length === 0) {
      context.res = { status: 200, body: { drifted: false, changeCount: 0 } }
      return
    }

    const record = {
      id:            `drift-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      subscriptionId, resourceId,
      resourceGroup: rgName,
      liveState:     live,
      baselineState: baseState,
      differences:   changes,
      severity,
      changeCount:   changes.length,
      detectedAt:    new Date().toISOString(),
    }

    await driftContainer.items.create(record)

    const apiUrl = process.env.EXPRESS_API_URL
    if (apiUrl) {
      await fetch(`${apiUrl}/internal/drift-event`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      }).catch(() => {})
    }

    context.res = { status: 200, body: { drifted: true, ...record } }
  } catch (err) {
    context.log.error('detectDrift error:', err.message)
    context.res = { status: 500, body: { error: err.message } }
  }
}
