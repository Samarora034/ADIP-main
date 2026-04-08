'use strict'
const { QueueServiceClient } = require('@azure/storage-queue')
const { TableClient }        = require('@azure/data-tables')
const { strip, diffObjects } = require('../shared/diff')
const { resolveIdentity }    = require('../shared/identity')
const { getResourceConfig }  = require('./azureResourceService')

<<<<<<< HEAD
let queueClient = null

// ── getQueueClient START ─────────────────────────────────────────────────────
// Lazily creates and returns the Storage Queue client singleton
function getQueueClient() {
  console.log('[getQueueClient] starts')
  if (!queueClient) {
=======
// ── Queue client ──────────────────────────────────────────────────────────────
let _queueClient = null
function getQueueClient() {
  if (!_queueClient) {
>>>>>>> 603e85ae615700dabfbeec3adeefee440674d11c
    const svc = QueueServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING)
    _queueClient = svc.getQueueClient(process.env.STORAGE_QUEUE_NAME || 'resource-changes')
  }
<<<<<<< HEAD
  console.log('[getQueueClient] ends')
  return queueClient
=======
  return _queueClient
>>>>>>> 603e85ae615700dabfbeec3adeefee440674d11c
}
// ── getQueueClient END ───────────────────────────────────────────────────────


<<<<<<< HEAD
// Identity cache: resolves object IDs to display names via Azure AD
const _identityCache = {}

// ── resolveIdentity START ────────────────────────────────────────────────────
// Resolves an Azure AD object ID (GUID) to a human-readable display name using az CLI
async function resolveIdentity(caller) {
  console.log('[resolveIdentity] starts — caller:', caller)
  if (!caller) {
    console.log('[resolveIdentity] ends — no caller provided')
    return null
  }
  if (caller.includes(' ') || caller.includes('@')) {
    console.log('[resolveIdentity] ends — already a display name')
    return caller
  }
  if (_identityCache[caller] !== undefined) {
    console.log('[resolveIdentity] ends — found in cache')
    return _identityCache[caller]
  }
  try {
    const { execSync } = require('child_process')
    let name = null
    try { name = execSync(`az ad user show --id ${caller} --query displayName -o tsv 2>/dev/null`, { timeout: 5000 }).toString().trim() } catch {}
    if (!name) try { name = execSync(`az ad sp show --id ${caller} --query displayName -o tsv 2>/dev/null`, { timeout: 5000 }).toString().trim() } catch {}
    _identityCache[caller] = name || caller
    console.log('[resolveIdentity] ends — resolved to:', _identityCache[caller])
    return _identityCache[caller]
  } catch {
    _identityCache[caller] = caller
    console.log('[resolveIdentity] ends — fallback to raw caller')
    return caller
  }
=======
// ── Persistent state cache (Azure Table Storage + in-memory L1) ───────────────
const _mem = {}
let _tableClient = null
function getTableClient() {
  if (!_tableClient)
    try { _tableClient = TableClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING, 'liveStateCache') } catch {}
  return _tableClient
}
function cacheKey(id) { return Buffer.from(id).toString('base64').replace(/[/\\#?]/g, '_') }

async function cacheGet(resourceId) {
  if (_mem[resourceId]) return _mem[resourceId]
  try {
    const e = await getTableClient()?.getEntity('state', cacheKey(resourceId))
    if (e) { _mem[resourceId] = JSON.parse(e.stateJson); return _mem[resourceId] }
  } catch {}
  return null
>>>>>>> 603e85ae615700dabfbeec3adeefee440674d11c
}
// ── resolveIdentity END ──────────────────────────────────────────────────────

<<<<<<< HEAD

// ── parseMessage START ───────────────────────────────────────────────────────
// Decodes a base64 Storage Queue message and extracts structured event fields
=======
async function cacheSet(resourceId, state) {
  _mem[resourceId] = state
  try {
    await getTableClient()?.upsertEntity(
      { partitionKey: 'state', rowKey: cacheKey(resourceId), stateJson: JSON.stringify(state) },
      'Replace'
    )
  } catch { /* non-fatal */ }
}

// Proxy so legacy code using liveStateCache[id] = x still works
const liveStateCache = new Proxy(_mem, {
  set(t, k, v) { t[k] = v; cacheSet(k, v).catch(() => {}); return true },
  get(t, k)    { return t[k] },
})

// ── Message parser ────────────────────────────────────────────────────────────
>>>>>>> 603e85ae615700dabfbeec3adeefee440674d11c
function parseMessage(msg) {
  console.log('[parseMessage] starts')
  try {
<<<<<<< HEAD
    const decoded     = Buffer.from(msg.messageText, 'base64').toString('utf-8')
    const parsed      = JSON.parse(decoded)
    const event       = Array.isArray(parsed) ? parsed[0] : parsed
    let resourceUri = event.data?.resourceUri || event.subject || ''
    // Normalise child resource URIs to parent resource (>9 path segments = child resource)
    const uriParts = resourceUri.split('/')
    if (uriParts.length > 9) resourceUri = uriParts.slice(0, 9).join('/')
    const parts = resourceUri.split('/')
    const resourceGroup = parts.length >= 5 ? parts[4] : (event.data?.resourceGroupName || '')

    // Extract caller display name from all known claim paths
=======
    const raw    = JSON.parse(Buffer.from(msg.messageText, 'base64').toString('utf-8'))
    const event  = Array.isArray(raw) ? raw[0] : raw
>>>>>>> 603e85ae615700dabfbeec3adeefee440674d11c
    const claims = event.data?.claims || {}

    // Normalize child resource URIs to parent (blobServices/default -> storageAccounts/foo)
    let resourceId = event.data?.resourceUri || event.subject || ''
    const parts    = resourceId.split('/')
    if (parts.length > 9) resourceId = parts.slice(0, 9).join('/')
    const uriParts = resourceId.split('/')

    // Extract best available caller identity from all known claim paths
    const givenName = claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || ''
    const surname   = claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname']   || ''
    const caller    = claims.name
      || claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
      || claims.unique_name
      || claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn']
      || (givenName && surname ? `${givenName} ${surname}` : '')
      || event.data?.caller
      || ''

    const result = {
      eventId:        event.id,
      eventType:      event.eventType,
<<<<<<< HEAD
      subject:        event.subject,
=======
>>>>>>> 603e85ae615700dabfbeec3adeefee440674d11c
      eventTime:      event.eventTime || new Date().toISOString(),
      resourceId,
      subscriptionId: uriParts[2] || event.data?.subscriptionId || '',
      resourceGroup:  uriParts.length >= 5 ? uriParts[4] : (event.data?.resourceGroupName || ''),
      operationName:  event.data?.operationName || event.eventType,
      status:         event.data?.status || 'Succeeded',
      caller,
    }
    console.log('[parseMessage] ends — resourceId:', result.resourceId)
    return result
  } catch {
    console.log('[parseMessage] ends — parse failed, returning null')
    return null
  }
}
// ── parseMessage END ─────────────────────────────────────────────────────────


<<<<<<< HEAD
const VOLATILE = ['etag','changedTime','createdTime','provisioningState','lastModifiedAt','systemData','_ts','_etag','primaryEndpoints','secondaryEndpoints','primaryLocation','secondaryLocation','statusOfPrimary','statusOfSecondary','creationTime']

// ── strip START ──────────────────────────────────────────────────────────────
// Recursively removes volatile ARM fields from an object to prevent false-positive diffs
function strip(obj) {
  console.log('[strip] starts')
  if (Array.isArray(obj)) {
    const result = obj.map(strip)
    console.log('[strip] ends — array')
    return result
  }
  if (obj && typeof obj === 'object') {
    const result = Object.fromEntries(
      Object.entries(obj).filter(([k]) => !VOLATILE.includes(k)).map(([k,v]) => [k, strip(v)])
    )
    console.log('[strip] ends — object')
    return result
  }
  console.log('[strip] ends — primitive')
  return obj
}
// ── strip END ────────────────────────────────────────────────────────────────


// ── safeStr START ────────────────────────────────────────────────────────────
// Safely converts any value to a string for use in diff sentences
function safeStr(val) {
  console.log('[safeStr] starts')
  let result
  if (val === null || val === undefined) result = 'null'
  else if (typeof val === 'object') result = JSON.stringify(val)
  else result = String(val)
  console.log('[safeStr] ends')
  return result
}
// ── safeStr END ──────────────────────────────────────────────────────────────


// ── computeDiff START ────────────────────────────────────────────────────────
// Recursive diff engine that handles nested objects, arrays, null transitions, and primitive changes
function computeDiff(prev, curr, path, results) {
  console.log('[computeDiff] starts — path:', path)
  if (prev === null || prev === undefined) {
    if (curr !== null && curr !== undefined) {
      if (typeof curr === 'object' && !Array.isArray(curr)) {
        for (const k of Object.keys(curr)) computeDiff(undefined, curr[k], `${path} → ${k}`, results)
      } else {
        const field = path.split(' → ').pop()
        const isTag = path.includes('tags')
        results.push({ path, type: 'added', oldValue: null, newValue: curr,
          sentence: isTag ? `added tag '${field}' = "${curr}"` : `added "${field}" = ${safeStr(curr)}` })
      }
    }
    console.log('[computeDiff] ends — prev was null/undefined')
    return
  }
  if (curr === null || curr === undefined) {
    const field = path.split(' → ').pop()
    const isTag = path.includes('tags')
    results.push({ path, type: 'removed', oldValue: prev, newValue: null,
      sentence: isTag ? `deleted tag '${field}'` : `removed "${field}" (was ${safeStr(prev)})` })
    console.log('[computeDiff] ends — curr is null/undefined (removed)')
    return
  }
  if (Array.isArray(prev) && Array.isArray(curr)) {
    const stableStr = (v) => JSON.stringify(v, Object.keys(v || {}).sort())
    const normArr = (a) => JSON.stringify(a.map(i => typeof i === 'object' && i ? stableStr(i) : i).sort())
    if (normArr(prev) !== normArr(curr)) {
      const added   = curr.filter(c => !prev.some(p => JSON.stringify(p) === JSON.stringify(c)))
      const removed = prev.filter(p => !curr.some(c => JSON.stringify(c) === JSON.stringify(p)))
      const field   = path.split(' → ').pop()
      if (added.length)   results.push({ path, type: 'array-added',   oldValue: prev, newValue: curr, sentence: `added ${added.length} item(s) to "${field}"` })
      if (removed.length) results.push({ path, type: 'array-removed', oldValue: prev, newValue: curr, sentence: `removed ${removed.length} item(s) from "${field}"` })
      if (!added.length && !removed.length) results.push({ path, type: 'array-reordered', oldValue: prev, newValue: curr, sentence: `reordered items in "${field}"` })
    }
    console.log('[computeDiff] ends — arrays compared')
    return
  }
  if (typeof prev === 'object' && typeof curr === 'object') {
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)])
    for (const k of allKeys) computeDiff(prev[k], curr[k], path ? `${path} → ${k}` : k, results)
    console.log('[computeDiff] ends — objects recursed')
    return
  }
  if (prev !== curr) {
    const field = path.split(' → ').pop()
    const isTag = path.includes('tags')
    results.push({ path, type: 'modified', oldValue: prev, newValue: curr,
      sentence: isTag ? `changed tag '${field}' from "${prev}" to "${curr}"` : `changed "${field}" from "${safeStr(prev)}" to "${safeStr(curr)}"` })
  }
  console.log('[computeDiff] ends — primitives compared')
}
// ── computeDiff END ──────────────────────────────────────────────────────────


// ── normalize START ──────────────────────────────────────────────────────────
// Flattens _childConfig into the top-level object so baselines without child config diff cleanly
function normalize(obj) {
  console.log('[normalize] starts')
  if (!obj || typeof obj !== 'object') {
    console.log('[normalize] ends — not an object')
    return obj
  }
  const { _childConfig, ...rest } = obj
  if (_childConfig) {
    Object.entries(_childConfig).forEach(([k, v]) => { rest[k] = v })
  }
  console.log('[normalize] ends')
  return rest
}
// ── normalize END ────────────────────────────────────────────────────────────


// ── formatDiff START ─────────────────────────────────────────────────────────
// Runs the full diff pipeline: normalise both states, compute changes, filter empty paths
function formatDiff(prev, curr) {
  console.log('[formatDiff] starts')
  const results = []
  computeDiff(normalize(prev), normalize(curr), '', results)
  const filtered = results.filter(r => r.path !== '')
  console.log('[formatDiff] ends — found', filtered.length, 'changes')
  return filtered
}
// ── formatDiff END ───────────────────────────────────────────────────────────


// liveStateCache — persisted to Azure Table Storage so restarts don't lose state
const { TableClient } = require('@azure/data-tables')
const _memCache = {}

// ── getTableClient START ─────────────────────────────────────────────────────
// Returns an Azure Table Storage client for the liveStateCache table
function getTableClient() {
  console.log('[getTableClient] starts')
  try {
    const client = TableClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING, 'liveStateCache')
    console.log('[getTableClient] ends')
    return client
  } catch {
    console.log('[getTableClient] ends — failed, returning null')
    return null
  }
}
// ── getTableClient END ───────────────────────────────────────────────────────


// ── cacheKey START ───────────────────────────────────────────────────────────
// Converts a resourceId into a Table Storage-safe row key (base64, no special chars)
function cacheKey(resourceId) {
  console.log('[cacheKey] starts')
  const key = Buffer.from(resourceId).toString('base64').replace(/[/\\#?]/g, '_')
  console.log('[cacheKey] ends')
  return key
}
// ── cacheKey END ─────────────────────────────────────────────────────────────


// ── cacheGet START ───────────────────────────────────────────────────────────
// Retrieves a cached resource state from memory (primary) or Azure Table Storage (fallback)
async function cacheGet(resourceId) {
  console.log('[cacheGet] starts — resourceId:', resourceId)
  if (_memCache[resourceId]) {
    console.log('[cacheGet] ends — found in memory cache')
    return _memCache[resourceId]
  }
  try {
    const client = getTableClient()
    if (!client) {
      console.log('[cacheGet] ends — no table client')
      return null
    }
    const entity = await client.getEntity('state', cacheKey(resourceId))
    const val = JSON.parse(entity.stateJson)
    _memCache[resourceId] = val
    console.log('[cacheGet] ends — loaded from Table Storage')
    return val
  } catch {
    console.log('[cacheGet] ends — not found in Table Storage')
    return null
  }
}
// ── cacheGet END ─────────────────────────────────────────────────────────────


// ── cacheSet START ───────────────────────────────────────────────────────────
// Writes a resource state to both the in-memory cache and Azure Table Storage
async function cacheSet(resourceId, state) {
  console.log('[cacheSet] starts — resourceId:', resourceId)
  _memCache[resourceId] = state
  try {
    const client = getTableClient()
    if (!client) {
      console.log('[cacheSet] ends — no table client, mem-only')
      return
    }
    await client.upsertEntity({ partitionKey: 'state', rowKey: cacheKey(resourceId), stateJson: JSON.stringify(state) }, 'Replace')
    console.log('[cacheSet] ends — persisted to Table Storage')
  } catch {
    console.log('[cacheSet] ends — Table Storage write failed, mem cache still updated')
  }
}
// ── cacheSet END ─────────────────────────────────────────────────────────────


// Proxy so existing code using liveStateCache[id] = x triggers cacheSet automatically
const liveStateCache = new Proxy(_memCache, {
  set(target, key, value) { target[key] = value; cacheSet(key, value).catch(() => {}); return true },
  get(target, key) { return target[key] }
})


// ── enrichWithDiff START ─────────────────────────────────────────────────────
// Fetches the live resource config, diffs against cached/baseline state, auto-saves genome snapshot on changes
async function enrichWithDiff(event) {
  console.log('[enrichWithDiff] starts — resourceId:', event.resourceId)
  if (!event.resourceId || !event.subscriptionId || !event.resourceGroup) {
    console.log('[enrichWithDiff] ends — missing required fields')
    return event
  }
  const callerPromise = resolveIdentity(event.caller)
  try {
    const liveRaw = await getResourceConfig(event.subscriptionId, event.resourceGroup, event.resourceId)
    const current = strip(liveRaw)

    let previous = await cacheGet(event.resourceId) || null

    if (!previous) {
      try {
        const { getBaseline } = require('./blobService')
        const baseline = await getBaseline(event.subscriptionId, event.resourceId)
        if (baseline?.resourceState) previous = strip(baseline.resourceState)
      } catch (_) {}
    }

    const changes = previous ? formatDiff(previous, current) : []

    liveStateCache[event.resourceId] = current

    if (changes.length > 0) {
      try {
        const { saveGenomeSnapshot } = require('./blobService')
        const label = `auto: ${changes.length} change(s) by ${event.caller || 'system'}`
        saveGenomeSnapshot(event.subscriptionId, event.resourceId, current, label).catch(() => {})
      } catch (_) {}
    }

    const resolvedCaller = await callerPromise
    const enriched = {
      ...event,
      caller:      resolvedCaller || event.caller || 'System',
      liveState:   current,
      changes,
      changeCount: changes.length,
      hasPrevious: !!previous,
    }
    console.log('[enrichWithDiff] ends — changes:', changes.length)
    return enriched
  } catch {
    console.log('[enrichWithDiff] ends — error, returning raw event')
    return event
  }
}
// ── enrichWithDiff END ───────────────────────────────────────────────────────


// Deduplication: same resource + operation within 10s = same change event
const dedupCache = new Map()

// ── isDuplicate START ────────────────────────────────────────────────────────
// Returns true if an identical event was already processed within the last 10 seconds
function isDuplicate(event) {
  console.log('[isDuplicate] starts — resourceId:', event.resourceId)
  const bucket = Math.floor(new Date(event.eventTime).getTime() / 10000)
  const key    = `${event.resourceId}:${event.operationName}:${bucket}`
  if (dedupCache.has(key)) {
    console.log('[isDuplicate] ends — IS duplicate')
    return true
  }
  dedupCache.set(key, Date.now())
  const cutoff = Date.now() - 60000
  for (const [k, ts] of dedupCache) { if (ts < cutoff) dedupCache.delete(k) }
  console.log('[isDuplicate] ends — not a duplicate')
=======
// ── Deduplication: same resource+operation within 10s = same event ────────────
const _dedup = new Map()
function isDuplicate(event) {
  const bucket = Math.floor(new Date(event.eventTime).getTime() / 10000)
  const key    = `${event.resourceId}:${event.operationName}:${bucket}`
  if (_dedup.has(key)) return true
  _dedup.set(key, Date.now())
  const cutoff = Date.now() - 60000
  for (const [k, ts] of _dedup) if (ts < cutoff) _dedup.delete(k)
>>>>>>> 603e85ae615700dabfbeec3adeefee440674d11c
  return false
}
// ── isDuplicate END ──────────────────────────────────────────────────────────

<<<<<<< HEAD

// ── startQueuePoller START ───────────────────────────────────────────────────
// Starts the Storage Queue polling loop — runs every QUEUE_POLL_INTERVAL_MS milliseconds
=======
// ── Enrich event with diff and resolved identity ──────────────────────────────
async function enrichWithDiff(event) {
  if (!event.resourceId || !event.subscriptionId || !event.resourceGroup) return event

  const [liveRaw, resolvedCaller] = await Promise.all([
    getResourceConfig(event.subscriptionId, event.resourceGroup, event.resourceId),
    resolveIdentity(event.caller),
  ])

  const current  = strip(liveRaw)
  const previous = await cacheGet(event.resourceId)
    || await (async () => {
      try {
        const { getBaseline } = require('./blobService')
        const b = await getBaseline(event.subscriptionId, event.resourceId)
        return b?.resourceState ? strip(b.resourceState) : null
      } catch { return null }
    })()

  const changes = previous ? diffObjects(previous, current) : []

  await cacheSet(event.resourceId, current)

  if (changes.length > 0) {
    try {
      const { saveGenomeSnapshot } = require('./blobService')
      const actor = resolvedCaller || event.caller || 'system'
      saveGenomeSnapshot(event.subscriptionId, event.resourceId, current,
        `auto: ${changes.length} change(s) by ${actor}`).catch(() => {})
    } catch {}
  }

  return {
    ...event,
    caller:      resolvedCaller || event.caller || 'System',
    liveState:   current,
    changes,
    changeCount: changes.length,
    hasPrevious: !!previous,
  }
}

// ── Poller ────────────────────────────────────────────────────────────────────
>>>>>>> 603e85ae615700dabfbeec3adeefee440674d11c
function startQueuePoller() {
  console.log('[startQueuePoller] starts')
  const interval = parseInt(process.env.QUEUE_POLL_INTERVAL_MS || '5000', 10)
  const client   = getQueueClient()

  setInterval(async () => {
    try {
      const { receivedMessageItems } = await client.receiveMessages({ numberOfMessages: 32, visibilityTimeout: 30 })
      for (const msg of receivedMessageItems) {
        const event = parseMessage(msg)
        if (!event) continue
        await client.deleteMessage(msg.messageId, msg.popReceipt)
        if (isDuplicate(event)) continue

        enrichWithDiff(event)
          .then(enriched => {
            if (!global.io) return
            const rooms = [
              enriched.subscriptionId,
              enriched.resourceGroup ? `${enriched.subscriptionId}:${enriched.resourceGroup}` : null,
            ].filter(Boolean)
            rooms.forEach(room => global.io.to(room).emit('resourceChange', enriched))
          })
          .catch(() => {})
      }
    } catch {}
  }, interval)

<<<<<<< HEAD
  console.log(`[startQueuePoller] ends — polling every ${interval}ms`)
=======
  console.log(`[ADIP] Queue poller started — interval ${interval}ms`)
>>>>>>> 603e85ae615700dabfbeec3adeefee440674d11c
}
// ── startQueuePoller END ─────────────────────────────────────────────────────

module.exports = { startQueuePoller, liveStateCache, cacheSet }