const router = require('express').Router()
const { ResourceManagementClient } = require('@azure/arm-resources')
const { DefaultAzureCredential } = require('@azure/identity')
const { getBaseline } = require('../services/cosmosService')
const { diff } = require('deep-diff')

const VOLATILE = ['etag', 'changedTime', 'createdTime', 'provisioningState', 'lastModifiedAt', 'systemData', '_ts', '_etag', '_rid', '_self', 'id']

function strip(obj) {
  if (Array.isArray(obj)) return obj.map(strip)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).filter(([k]) => !VOLATILE.includes(k)).map(([k, v]) => [k, strip(v)]))
  return obj
}

// POST /api/remediate
// Reverts the live Azure resource back to match the golden baseline
router.post('/remediate', async (req, res) => {
  const { subscriptionId, resourceGroupId, resourceId } = req.body
  if (!subscriptionId || !resourceGroupId || !resourceId)
    return res.status(400).json({ error: 'subscriptionId, resourceGroupId and resourceId required' })

  try {
    // 1. Fetch golden baseline
    const baseline = await getBaseline(subscriptionId, resourceId)
    if (!baseline?.resourceState)
      return res.status(404).json({ error: 'No golden baseline found for this resource' })

    const baselineState = strip(baseline.resourceState)

    // 2. Fetch current live state
    const credential = new DefaultAzureCredential()
    const armClient  = new ResourceManagementClient(credential, subscriptionId)
    const parts      = resourceId.split('/')
    const provider   = parts[6]
    const type       = parts[7]
    const name       = parts[8]

    const liveRaw  = await armClient.resources.get(resourceGroupName, provider, '', type, name, '2021-04-01')
    const liveState = strip(liveRaw)

    // 3. Compute what will change (baseline → live, reversed = what we revert)
    const differences = diff(liveState, baselineState) || []

    // 4. Apply baseline state back to Azure (PUT resource)
    const resourceGroupName = parts[4]
    await armClient.resources.beginCreateOrUpdateAndWait(
      resourceGroupName, provider, '', type, name, '2021-04-01',
      { ...baselineState, location: baseline.resourceState.location }
    )

    res.json({
      remediated: true,
      resourceId,
      changeCount: differences.length,
      appliedBaseline: baselineState,
      previousLiveState: liveState,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
