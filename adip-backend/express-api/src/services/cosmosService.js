const { CosmosClient } = require('@azure/cosmos')

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
})

const db = client.database(process.env.COSMOS_DB)

const driftContainer    = () => db.container(process.env.COSMOS_CONTAINER_DRIFT)
const baselineContainer = () => db.container(process.env.COSMOS_CONTAINER_BASELINE)

async function getDriftRecords({ subscriptionId, resourceGroup, severity, limit = 50 }) {
  let query = 'SELECT TOP @limit * FROM c WHERE c.subscriptionId = @sub'
  const params = [
    { name: '@limit', value: Number(limit) },
    { name: '@sub',   value: subscriptionId },
  ]
  if (resourceGroup) { query += ' AND c.resourceGroup = @rg'; params.push({ name: '@rg', value: resourceGroup }) }
  if (severity)      { query += ' AND c.severity = @sev';     params.push({ name: '@sev', value: severity }) }
  query += ' ORDER BY c._ts DESC'
  const { resources } = await driftContainer().items.query({ query, parameters: params }).fetchAll()
  return resources
}

async function getBaseline(subscriptionId, resourceId) {
  const query = {
    query: 'SELECT TOP 1 * FROM c WHERE c.resourceId = @rid AND c.subscriptionId = @sub AND c.active = true ORDER BY c._ts DESC',
    parameters: [
      { name: '@rid', value: resourceId || '' },
      { name: '@sub', value: subscriptionId },
    ],
  }
  const { resources } = await baselineContainer().items.query(query).fetchAll()
  return resources[0] || null
}

async function saveBaseline(subscriptionId, resourceGroupId, resourceId, resourceState) {
  // Deactivate previous baselines for this resource
  const existing = await baselineContainer().items
    .query({ query: 'SELECT * FROM c WHERE c.resourceId = @rid', parameters: [{ name: '@rid', value: resourceId }] })
    .fetchAll()
  for (const doc of existing.resources) {
    await baselineContainer().item(doc.id, doc.resourceId).replace({ ...doc, active: false })
  }
  const item = {
    id: `baseline-${Buffer.from(resourceId || resourceGroupId).toString('base64').replace(/[/+=]/g, '_')}-${Date.now()}`,
    subscriptionId, resourceGroupId, resourceId,
    resourceState, active: true,
    promotedAt: new Date().toISOString(),
  }
  await baselineContainer().items.create(item)
  return item
}

async function saveDriftRecord(record) {
  const safeId = `drift-${Date.now()}-${Math.random().toString(36).slice(2)}`
  await driftContainer().items.create({ id: safeId, ...record })
}

module.exports = { getDriftRecords, getBaseline, saveBaseline, saveDriftRecord }
