const { QueueServiceClient } = require('@azure/storage-queue')
const { getResourceConfig }  = require('./azureResourceService')
const { diff }               = require('deep-diff')

let queueClient = null

function getQueueClient() {
  if (!queueClient) {
    const svc = QueueServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING)
    queueClient = svc.getQueueClient(process.env.STORAGE_QUEUE_NAME || 'resource-changes')
  }
  return queueClient
}

function parseMessage(msg) {
  try {
    const decoded     = Buffer.from(msg.messageText, 'base64').toString('utf-8')
    const parsed      = JSON.parse(decoded)
    const event       = Array.isArray(parsed) ? parsed[0] : parsed
    const resourceUri = event.data?.resourceUri || event.subject || ''
    const parts       = resourceUri.split('/')
    const resourceGroup = parts.length >= 5 ? parts[4] : (event.data?.resourceGroupName || '')

    // Extract caller: prefer display name from claims, fall back to email/UPN
    const claims = event.data?.claims || {}
    const caller  = claims.name || claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name']
                 || event.data?.caller || 'Unknown user'

    return {
      eventId:        event.id,
      eventType:      event.eventType,
      subject:        event.subject,
      // Task 3: use Azure eventTime, not frontend render time
      eventTime:      event.eventTime || new Date().toISOString(),
      resourceId:     resourceUri,
      subscriptionId: parts[2] || event.data?.subscriptionId || '',
      resourceGroup,
      operationName:  event.data?.operationName || event.eventType,
      status:         event.data?.status || 'Succeeded',
      caller,
    }
  } catch { return null }
}

const VOLATILE = ['etag','changedTime','createdTime','provisioningState','lastModifiedAt','systemData','_ts','_etag']
function strip(obj) {
  if (Array.isArray(obj)) return obj.map(strip)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).filter(([k]) => !VOLATILE.includes(k)).map(([k,v]) => [k, strip(v)]))
  return obj
}

// Task 2: produce clean field label from a dot-path
function friendlyLabel(path) {
  // e.g. "properties → accessTier" → "access tier"
  //      "tags → environment"       → "tag 'environment'"
  const parts = path.split(' → ')
  const last  = parts[parts.length - 1]
  const isTag = parts.includes('tags')
  if (isTag) return `tag '${last}'`
  // camelCase → words
  return last.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toLowerCase()).trim()
}

// Task 2: format diff into human-readable sentences
function formatDiff(differences) {
  if (!differences?.length) return []
  return differences.map(d => {
    const path  = d.path?.join(' → ') ?? '(root)'
    const label = friendlyLabel(path)
    const isTag = path.includes('tags')
    switch (d.kind) {
      case 'E': return {
        path, type: 'modified',
        label,
        oldValue: d.lhs, newValue: d.rhs,
        sentence: isTag
          ? `changed ${label} from "${d.lhs}" to "${d.rhs}"`
          : `changed ${label} from "${d.lhs}" to "${d.rhs}"`,
      }
      case 'N': return {
        path, type: 'added',
        label,
        oldValue: null, newValue: d.rhs,
        sentence: isTag
          ? `added ${label} = "${d.rhs}"`
          : `added ${label} = "${JSON.stringify(d.rhs)}"`,
      }
      case 'D': return {
        path, type: 'removed',
        label,
        oldValue: d.lhs, newValue: null,
        sentence: isTag
          ? `deleted ${label}`
          : `removed ${label} (was "${JSON.stringify(d.lhs)}")`,
      }
      case 'A': return {
        path: `${path}[${d.index}]`, type: 'array',
        label,
        oldValue: d.item?.lhs, newValue: d.item?.rhs,
        sentence: `modified ${label} array`,
      }
      default: return null
    }
  }).filter(Boolean)
}

// Task 1: in-memory cache of last known live state per resourceId
// Exported so the /api/cache-state endpoint can pre-seed it on Submit
const liveStateCache = {}

async function enrichWithDiff(event) {
  if (!event.resourceId || !event.subscriptionId || !event.resourceGroup) return event
  try {
    const liveRaw  = await getResourceConfig(event.subscriptionId, event.resourceGroup, event.resourceId)
    const current  = strip(liveRaw)
    const previous = liveStateCache[event.resourceId] || null
    const rawDiff  = previous ? (diff(previous, current) || []) : []
    const changes  = formatDiff(rawDiff)

    // Always update cache after fetching
    liveStateCache[event.resourceId] = current

    return {
      ...event,
      liveState:   current,
      changes,
      changeCount: changes.length,
      hasPrevious: !!previous,
    }
  } catch {
    return event
  }
}

// Deduplication keyed on eventId
const dedupCache = new Set()
function isDuplicate(event) {
  const key = event.eventId || `${event.resourceId}:${event.eventTime}`
  if (dedupCache.has(key)) return true
  dedupCache.add(key)
  if (dedupCache.size > 500) {
    const iter = dedupCache.values()
    for (let i = 0; i < 100; i++) dedupCache.delete(iter.next().value)
  }
  return false
}

function startQueuePoller() {
  const interval = parseInt(process.env.QUEUE_POLL_INTERVAL_MS || '5000', 10)
  const client   = getQueueClient()

  setInterval(async () => {
    try {
      const response = await client.receiveMessages({ numberOfMessages: 32, visibilityTimeout: 30 })
      for (const msg of response.receivedMessageItems) {
        const event = parseMessage(msg)
        if (!event) continue
        await client.deleteMessage(msg.messageId, msg.popReceipt)
        if (isDuplicate(event)) continue

        enrichWithDiff(event).then(enriched => {
          if (global.io) {
            const rooms = [enriched.subscriptionId, `${enriched.subscriptionId}:${enriched.resourceGroup}`].filter(Boolean)
            rooms.forEach(room => global.io.to(room).emit('resourceChange', enriched))
          }
        })
      }
    } catch (_) {}
  }, interval)

  console.log(`Queue poller started — polling every ${interval}ms`)
}

module.exports = { startQueuePoller, liveStateCache }
