const { ResourceManagementClient } = require('@azure/arm-resources')
const { SubscriptionClient } = require('@azure/arm-subscriptions')
const { DefaultAzureCredential } = require('@azure/identity')

const credential = new DefaultAzureCredential()

function resourceClient(subscriptionId) {
  return new ResourceManagementClient(credential, subscriptionId)
}

async function listSubscriptions() {
  const client = new SubscriptionClient(credential)
  const subs = []
  for await (const s of client.subscriptions.list()) subs.push(s)
  return subs
}

async function listResourceGroups(subscriptionId) {
  const client = resourceClient(subscriptionId)
  const rgs = []
  for await (const rg of client.resourceGroups.list()) rgs.push(rg)
  return rgs
}

async function listResources(subscriptionId, resourceGroupName) {
  const client = resourceClient(subscriptionId)
  const resources = []
  for await (const r of client.resources.listByResourceGroup(resourceGroupName)) resources.push(r)
  return resources
}

async function getResourceConfig(subscriptionId, resourceGroupName, resourceId) {
  const client = resourceClient(subscriptionId)
  if (resourceId) {
    // Full resource ID path — use generic get
    const parts = resourceId.split('/')
    const provider = parts[6]
    const type = parts[7]
    const name = parts[8]
    return client.resources.get(resourceGroupName, provider, '', type, name, '2021-04-01')
  }
  // Return all resources in the group
  const resources = []
  for await (const r of client.resources.listByResourceGroup(resourceGroupName, { expand: 'properties' })) {
    resources.push(r)
  }
  const rg = await client.resourceGroups.get(resourceGroupName)
  return { resourceGroup: rg, resources }
}

module.exports = { listSubscriptions, listResourceGroups, listResources, getResourceConfig }
