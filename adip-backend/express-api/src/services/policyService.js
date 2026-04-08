const { PolicyInsightsClient } = require('@azure/arm-policyinsights')
const { DefaultAzureCredential } = require('@azure/identity')

const credential = new DefaultAzureCredential()


// ── getPolicyCompliance START ────────────────────────────────────────────────
// Queries Azure Policy compliance state for a specific resource or resource group (read-only)
async function getPolicyCompliance(subscriptionId, resourceGroupName, resourceId = null) {
  console.log('[getPolicyCompliance] starts — subscriptionId:', subscriptionId, 'rg:', resourceGroupName, 'resourceId:', resourceId)
  const client = new PolicyInsightsClient(credential, subscriptionId)

  const results = []

  if (resourceId) {
    const parts    = resourceId.split('/')
    const provider = parts[6]
    const type     = parts[7]
    const name     = parts[8]

    const resourceScope = `subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/${provider}/${type}/${name}`

    for await (const state of client.policyStates.listQueryResultsForResource(
      'latest', resourceScope, { queryOptions: { top: 50 } }
    )) {
      results.push(formatState(state))
    }
  } else {
    for await (const state of client.policyStates.listQueryResultsForResourceGroup(
      'latest', subscriptionId, resourceGroupName, { queryOptions: { top: 100 } }
    )) {
      results.push(formatState(state))
    }
  }

  const nonCompliant = results.filter(r => r.complianceState === 'NonCompliant')
  const compliant    = results.filter(r => r.complianceState === 'Compliant')

  const result = {
    total:        results.length,
    nonCompliant: nonCompliant.length,
    compliant:    compliant.length,
    summary:      nonCompliant.length === 0 ? 'compliant' : 'non-compliant',
    violations:   nonCompliant,
  }
  console.log('[getPolicyCompliance] ends — total:', results.length, 'nonCompliant:', nonCompliant.length)
  return result
}
// ── getPolicyCompliance END ──────────────────────────────────────────────────


// ── formatState START ────────────────────────────────────────────────────────
// Maps a raw PolicyInsights state object to a clean, serialisable result shape
function formatState(state) {
  console.log('[formatState] starts')
  const result = {
    complianceState:        state.complianceState,
    policyAssignmentName:   state.policyAssignmentName,
    policyDefinitionName:   state.policyDefinitionName,
    policyDefinitionAction: state.policyDefinitionAction,
    resourceId:             state.resourceId,
    resourceType:           state.resourceType,
    timestamp:              state.timestamp,
  }
  console.log('[formatState] ends — state:', result.complianceState)
  return result
}
// ── formatState END ──────────────────────────────────────────────────────────

module.exports = { getPolicyCompliance }