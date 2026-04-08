const { BlobServiceClient } = require('@azure/storage-blob')

// Lazy-initialize so module can be required before dotenv loads
let _blobService = null

// ── getBlobService START ─────────────────────────────────────────────────────
// Lazily initialises and returns the BlobServiceClient singleton
function getBlobService() {
  console.log('[getBlobService] starts')
  if (!_blobService) _blobService = BlobServiceClient.fromConnectionString(process.env.STORAGE_CONNECTION_STRING)
  console.log('[getBlobService] ends')
  return _blobService
}
// ── getBlobService END ───────────────────────────────────────────────────────


// Container handles — lazy, reused across calls
const containers = {}

// ── container START ──────────────────────────────────────────────────────────
// Returns (or lazily creates) a cached ContainerClient for the given container name
function container(name) {
  console.log('[container] starts — name:', name)
  if (!containers[name]) containers[name] = getBlobService().getContainerClient(name)
  console.log('[container] ends')
  return containers[name]
}
// ── container END ────────────────────────────────────────────────────────────


// ── blobKey START ────────────────────────────────────────────────────────────
// Converts a resourceId into a deterministic, URL-safe blob name using base64url encoding
function blobKey(resourceId) {
  console.log('[blobKey] starts')
  const key = Buffer.from(resourceId).toString('base64url') + '.json'
  console.log('[blobKey] ends')
  return key
}
// ── blobKey END ──────────────────────────────────────────────────────────────


// ── driftKey START ───────────────────────────────────────────────────────────
// Creates a timestamp-prefixed blob name for drift records so they list chronologically
function driftKey(resourceId, ts) {
  console.log('[driftKey] starts')
  const stamp = (ts || new Date().toISOString()).replace(/[:.]/g, '-')
  const key = `${stamp}_${Buffer.from(resourceId).toString('base64url')}.json`
  console.log('[driftKey] ends')
  return key
}
// ── driftKey END ─────────────────────────────────────────────────────────────


// ── readBlob START ───────────────────────────────────────────────────────────
// Downloads and JSON-parses a blob; returns null if the blob does not exist
async function readBlob(containerName, blobName) {
  console.log('[readBlob] starts — container:', containerName, 'blob:', blobName)
  try {
    const blob  = container(containerName).getBlobClient(blobName)
    const buf   = await blob.downloadToBuffer()
    const result = JSON.parse(buf.toString('utf-8'))
    console.log('[readBlob] ends')
    return result
  } catch (e) {
    if (e.statusCode === 404 || e.code === 'BlobNotFound') {
      console.log('[readBlob] ends — blob not found')
      return null
    }
    console.log('[readBlob] ends — unexpected error:', e.message)
    throw e
  }
}
// ── readBlob END ─────────────────────────────────────────────────────────────


// ── writeBlob START ──────────────────────────────────────────────────────────
// Serialises data to JSON and uploads it as a block blob with application/json content type
async function writeBlob(containerName, blobName, data) {
  console.log('[writeBlob] starts — container:', containerName, 'blob:', blobName)
  const body = JSON.stringify(data)
  await container(containerName)
    .getBlockBlobClient(blobName)
    .upload(body, Buffer.byteLength(body), { blobHTTPHeaders: { blobContentType: 'application/json' } })
  console.log('[writeBlob] ends')
}
// ── writeBlob END ────────────────────────────────────────────────────────────


// ── Baselines ─────────────────────────────────────────────────────────────────

// ── getBaseline START ────────────────────────────────────────────────────────
// Reads the golden baseline for a resource from the baselines container
async function getBaseline(subscriptionId, resourceId) {
  console.log('[getBaseline] starts — subscriptionId:', subscriptionId, 'resourceId:', resourceId)
  if (!resourceId) {
    console.log('[getBaseline] ends — no resourceId provided')
    return null
  }
  const doc = await readBlob('baselines', blobKey(resourceId))
  if (doc && doc.subscriptionId !== subscriptionId) {
    console.log('[getBaseline] ends — subscriptionId mismatch')
    return null
  }
  console.log('[getBaseline] ends')
  return doc
}
// ── getBaseline END ──────────────────────────────────────────────────────────


// ── saveBaseline START ───────────────────────────────────────────────────────
// Writes a new golden baseline document to the baselines container
async function saveBaseline(subscriptionId, resourceGroupId, resourceId, resourceState) {
  console.log('[saveBaseline] starts — resourceId:', resourceId)
  const doc = {
    id: blobKey(resourceId),
    subscriptionId, resourceGroupId, resourceId,
    resourceState, active: true,
    promotedAt: new Date().toISOString(),
  }
  await writeBlob('baselines', blobKey(resourceId), doc)
  console.log('[saveBaseline] ends')
  return doc
}
// ── saveBaseline END ─────────────────────────────────────────────────────────


// ── upsertBaseline START ─────────────────────────────────────────────────────
// Overwrites (or creates) the golden baseline — blob overwrite acts as upsert
async function upsertBaseline(subscriptionId, resourceGroupId, resourceId, resourceState) {
  console.log('[upsertBaseline] starts — resourceId:', resourceId)
  const result = await saveBaseline(subscriptionId, resourceGroupId, resourceId, resourceState)
  console.log('[upsertBaseline] ends')
  return result
}
// ── upsertBaseline END ───────────────────────────────────────────────────────


// ── Drift Records ─────────────────────────────────────────────────────────────

// ── saveDriftRecord START ────────────────────────────────────────────────────
// Persists a drift detection record to the drift-records container
async function saveDriftRecord(record) {
  console.log('[saveDriftRecord] starts — resourceId:', record.resourceId)
  const key = driftKey(record.resourceId || 'unknown', record.detectedAt)
  await writeBlob('drift-records', key, { ...record, _blobKey: key })
  console.log('[saveDriftRecord] ends')
}
// ── saveDriftRecord END ──────────────────────────────────────────────────────


// ── getDriftRecords START ────────────────────────────────────────────────────
// Lists and filters drift records from Blob Storage sorted newest-first
async function getDriftRecords({ subscriptionId, resourceGroup, severity, limit = 50 }) {
  console.log('[getDriftRecords] starts — subscriptionId:', subscriptionId)
  const results = []
  for await (const blob of container('drift-records').listBlobsFlat()) {
    if (results.length >= Number(limit)) break
    const doc = await readBlob('drift-records', blob.name)
    if (!doc) continue
    if (doc.subscriptionId !== subscriptionId) continue
    if (resourceGroup && doc.resourceGroup !== resourceGroup) continue
    if (severity && doc.severity !== severity) continue
    results.push(doc)
  }
  const sorted = results.sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt))
  console.log('[getDriftRecords] ends — returned:', sorted.length, 'records')
  return sorted
}
// ── getDriftRecords END ──────────────────────────────────────────────────────


// ── getDriftHistory START ────────────────────────────────────────────────────
// Filtered drift history listing with optional date range, resource, and resource group filters
async function getDriftHistory({ subscriptionId, startDate, endDate, resourceId, resourceGroup, limit = 100 }) {
  console.log('[getDriftHistory] starts — subscriptionId:', subscriptionId)
  const results = []
  const startTs = startDate ? new Date(startDate).toISOString().replace(/[:.]/g, '-') : null
  const endTs   = endDate   ? new Date(endDate).toISOString().replace(/[:.]/g, '-')   : null

  for await (const blob of container('drift-records').listBlobsFlat()) {
    if (results.length >= Number(limit)) break
    const blobTs = blob.name.slice(0, 24)
    if (startTs && blobTs < startTs) continue
    if (endTs   && blobTs > endTs)   continue

    const doc = await readBlob('drift-records', blob.name)
    if (!doc) continue
    if (doc.subscriptionId !== subscriptionId) continue
    if (resourceGroup && doc.resourceGroup !== resourceGroup) continue
    if (resourceId    && doc.resourceId    !== resourceId)    continue
    results.push(doc)
  }
  const sorted = results.sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt))
  console.log('[getDriftHistory] ends — returned:', sorted.length, 'records')
  return sorted
}
// ── getDriftHistory END ──────────────────────────────────────────────────────


// ── Configuration Genome ──────────────────────────────────────────────────────

// ── saveGenomeSnapshot START ─────────────────────────────────────────────────
// Saves a versioned configuration snapshot to the baseline-genome container
async function saveGenomeSnapshot(subscriptionId, resourceId, resourceState, label = '') {
  console.log('[saveGenomeSnapshot] starts — resourceId:', resourceId, 'label:', label)
  const ts  = new Date().toISOString()
  const key = `${ts.replace(/[:.]/g, '-')}_${Buffer.from(resourceId).toString('base64url')}.json`
  const doc = { subscriptionId, resourceId, resourceState, label, savedAt: ts }
  await writeBlob('baseline-genome', key, doc)
  console.log('[saveGenomeSnapshot] ends — key:', key)
  return { ...doc, _blobKey: key }
}
// ── saveGenomeSnapshot END ───────────────────────────────────────────────────


// ── listGenomeSnapshots START ────────────────────────────────────────────────
// Lists all genome snapshots for a resource, sorted newest-first
async function listGenomeSnapshots(subscriptionId, resourceId, limit = 50) {
  console.log('[listGenomeSnapshots] starts — subscriptionId:', subscriptionId, 'resourceId:', resourceId)
  const results = []
  for await (const blob of container('baseline-genome').listBlobsFlat()) {
    if (results.length >= limit) break
    const doc = await readBlob('baseline-genome', blob.name)
    if (!doc) continue
    if (doc.subscriptionId !== subscriptionId) continue
    if (resourceId && doc.resourceId !== resourceId) continue
    results.push({ ...doc, _blobKey: blob.name })
  }
  const sorted = results.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
  console.log('[listGenomeSnapshots] ends — returned:', sorted.length, 'snapshots')
  return sorted
}
// ── listGenomeSnapshots END ──────────────────────────────────────────────────


// ── getGenomeSnapshot START ──────────────────────────────────────────────────
// Retrieves a single genome snapshot by its blob key (O(1) point read)
async function getGenomeSnapshot(blobKey) {
  console.log('[getGenomeSnapshot] starts — blobKey:', blobKey)
  const result = await readBlob('baseline-genome', blobKey)
  console.log('[getGenomeSnapshot] ends')
  return result
}
// ── getGenomeSnapshot END ────────────────────────────────────────────────────

module.exports = {
  getBaseline,
  saveBaseline,
  upsertBaseline,
  saveDriftRecord,
  getDriftRecords,
  getDriftHistory,
  saveGenomeSnapshot,
  listGenomeSnapshots,
  getGenomeSnapshot,
}