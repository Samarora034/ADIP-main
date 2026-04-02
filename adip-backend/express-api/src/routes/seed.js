const router = require('express').Router()
const { saveBaseline } = require('../services/blobService')

const DUMMY_BASELINE = {
  name: 'adipstore001',
  type: 'Microsoft.Storage/storageAccounts',
  location: 'westus2',
  sku: { name: 'Standard_LRS', tier: 'Standard' },
  kind: 'StorageV2',
  properties: {
    minimumTlsVersion: 'TLS1_2',
    allowBlobPublicAccess: false,
    allowSharedKeyAccess: true,
    networkAcls: { defaultAction: 'Allow', bypass: 'AzureServices', ipRules: [], virtualNetworkRules: [] },
    supportsHttpsTrafficOnly: true,
    encryption: {
      services: {
        blob: { enabled: true, keyType: 'Account' },
        file: { enabled: true, keyType: 'Account' },
      },
      keySource: 'Microsoft.Storage',
    },
    accessTier: 'Hot',
  },
  tags: { environment: 'production', team: 'platform', costCenter: 'CC-1001' },
}

router.post('/seed-baseline', async (req, res) => {
  const subscriptionId  = req.body.subscriptionId  || '8f461bb6-e3a4-468b-b134-8b1269337ac7'
  const resourceId      = req.body.resourceId      || '/subscriptions/8f461bb6-e3a4-468b-b134-8b1269337ac7/resourceGroups/rg-adip/providers/Microsoft.Storage/storageAccounts/adipstore001'
  const resourceGroupId = req.body.resourceGroupId || 'rg-adip'
  try {
    const saved = await saveBaseline(subscriptionId, resourceGroupId, resourceId, DUMMY_BASELINE)
    res.json({ message: 'Golden baseline seeded', baseline: saved })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
