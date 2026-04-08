const router = require('express').Router()
const { saveGenomeSnapshot, listGenomeSnapshots, getGenomeSnapshot, saveBaseline } = require('../services/blobService')
const { getResourceConfig, getApiVersion } = require('../services/azureResourceService')
const { ResourceManagementClient } = require('@azure/arm-resources')
const { DefaultAzureCredential } = require('@azure/identity')


// ── GET /api/genome START ────────────────────────────────────────────────────
// Returns all versioned configuration snapshots for a resource, sorted newest-first
router.get('/genome', async (req, res) => {
  console.log('[GET /genome] starts')
  const { subscriptionId, resourceId, limit } = req.query
  if (!subscriptionId) {
    console.log('[GET /genome] ends — missing subscriptionId')
    return res.status(400).json({ error: 'subscriptionId required' })
  }
  try {
    const snapshots = await listGenomeSnapshots(subscriptionId, resourceId, Number(limit) || 50)
    res.json(snapshots)
    console.log('[GET /genome] ends — returned:', snapshots.length, 'snapshots')
  } catch (err) {
    console.log('[GET /genome] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── GET /api/genome END ──────────────────────────────────────────────────────


// ── POST /api/genome/save START ──────────────────────────────────────────────
// Fetches the current live ARM config and saves it as a labelled genome snapshot
router.post('/genome/save', async (req, res) => {
  console.log('[POST /genome/save] starts')
  const { subscriptionId, resourceGroupId, resourceId, label } = req.body
  if (!subscriptionId || !resourceGroupId || !resourceId) {
    console.log('[POST /genome/save] ends — missing required fields')
    return res.status(400).json({ error: 'subscriptionId, resourceGroupId and resourceId required' })
  }
  try {
    const liveConfig = await getResourceConfig(subscriptionId, resourceGroupId, resourceId)
    const snapshot = await saveGenomeSnapshot(subscriptionId, resourceId, liveConfig, label || '')
    res.json(snapshot)
    console.log('[POST /genome/save] ends — snapshot saved with key:', snapshot._blobKey)
  } catch (err) {
    console.log('[POST /genome/save] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── POST /api/genome/save END ────────────────────────────────────────────────


// ── POST /api/genome/promote START ───────────────────────────────────────────
// Promotes a genome snapshot to the golden baseline by overwriting the baselines container entry
router.post('/genome/promote', async (req, res) => {
  console.log('[POST /genome/promote] starts')
  const { subscriptionId, resourceGroupId, resourceId, blobKey } = req.body
  if (!subscriptionId || !resourceId || !blobKey) {
    console.log('[POST /genome/promote] ends — missing required fields')
    return res.status(400).json({ error: 'subscriptionId, resourceId and blobKey required' })
  }
  try {
    const snapshot = await getGenomeSnapshot(blobKey)
    if (!snapshot?.resourceState) {
      console.log('[POST /genome/promote] ends — snapshot not found')
      return res.status(404).json({ error: 'Snapshot not found' })
    }
    await saveBaseline(subscriptionId, resourceGroupId || '', resourceId, snapshot.resourceState)
    res.json({ promoted: true, resourceId, blobKey })
    console.log('[POST /genome/promote] ends — promoted blobKey:', blobKey)
  } catch (err) {
    console.log('[POST /genome/promote] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── POST /api/genome/promote END ─────────────────────────────────────────────


// ── POST /api/genome/rollback START ──────────────────────────────────────────
// Reverts an Azure resource to a specific genome snapshot via ARM PUT (synchronous)
router.post('/genome/rollback', async (req, res) => {
  console.log('[POST /genome/rollback] starts')
  const { subscriptionId, resourceGroupId, resourceId, blobKey } = req.body
  if (!subscriptionId || !resourceGroupId || !resourceId || !blobKey) {
    console.log('[POST /genome/rollback] ends — missing required fields')
    return res.status(400).json({ error: 'subscriptionId, resourceGroupId, resourceId and blobKey required' })
  }
  try {
    const snapshot = await getGenomeSnapshot(blobKey)
    if (!snapshot?.resourceState) {
      console.log('[POST /genome/rollback] ends — snapshot not found')
      return res.status(404).json({ error: 'Snapshot not found' })
    }

    const VOLATILE = ['etag','changedTime','createdTime','provisioningState','lastModifiedAt','systemData','_ts','_etag','_childConfig']

    // ── strip (rollback) START ─────────────────────────────────────────────
    // Strips volatile fields from the snapshot state before applying ARM PUT
    function strip(obj) {
      console.log('[rollback.strip] starts')
      if (Array.isArray(obj)) {
        const r = obj.map(strip)
        console.log('[rollback.strip] ends — array')
        return r
      }
      if (obj && typeof obj === 'object') {
        const r = Object.fromEntries(
          Object.entries(obj).filter(([k]) => !VOLATILE.includes(k)).map(([k,v]) => [k, strip(v)])
        )
        console.log('[rollback.strip] ends — object')
        return r
      }
      console.log('[rollback.strip] ends — primitive')
      return obj
    }
    // ── strip (rollback) END ───────────────────────────────────────────────

    const state      = strip(snapshot.resourceState)
    const credential = new DefaultAzureCredential()
    const armClient  = new ResourceManagementClient(credential, subscriptionId)
    const parts      = resourceId.split('/')
    const rgName     = parts[4], provider = parts[6], type = parts[7], name = parts[8]
    const apiVersion = await getApiVersion(subscriptionId, provider, type)

    let location = state.location
    if (!location) {
      try {
        const live = await armClient.resources.get(rgName, provider, '', type, name, apiVersion)
        location = live.location
      } catch { location = 'eastus' }
    }

    await armClient.resources.beginCreateOrUpdateAndWait(rgName, provider, '', type, name, apiVersion, { ...state, location })
    res.json({ rolledBack: true, resourceId, blobKey, savedAt: snapshot.savedAt })
    console.log('[POST /genome/rollback] ends — rolled back to:', snapshot.savedAt)
  } catch (err) {
    console.log('[POST /genome/rollback] ends — error:', err.message)
    res.status(500).json({ error: err.message })
  }
})
// ── POST /api/genome/rollback END ────────────────────────────────────────────

module.exports = router