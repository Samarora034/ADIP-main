const { PolicyInsightsClient } = require('@azure/arm-policyinsights')
const { DefaultAzureCredential } = require('@azure/identity')

const credential = new DefaultAzureCredential()

/**
 * Get policy compliance state for a specific resource or resource group.
 * Returns array of non-compliant policy assignments with details.
 */
async function getPolicyCompliance(subscriptionId, resourceGroupName, resourceId = null) {
  const client = new PolicyInsightsClient(credential, subscriptionId)

  const results = []

  if (resourceId) {
    // Query compliance for a specific resource
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
    // Query compliance for entire resource group
    for await (const state of client.policyStates.listQueryResultsForResourceGroup(
      'latest', subscriptionId, resourceGroupName, { queryOptions: { top: 100 } }
    )) {
      results.push(formatState(state))
    }
  }

  const nonCompliant = results.filter(r => r.complianceState === 'NonCompliant')
  const compliant    = results.filter(r => r.complianceState === 'Compliant')

  return {
    total:        results.length,
    nonCompliant: nonCompliant.length,
    compliant:    compliant.length,
    summary:      nonCompliant.length === 0 ? 'compliant' : 'non-compliant',
    violations:   nonCompliant,
  }
}

function formatState(state) {
  return {
    complianceState:      state.complianceState,
    policyAssignmentName: state.policyAssignmentName,
    policyDefinitionName: state.policyDefinitionName,
    policyDefinitionAction: state.policyDefinitionAction,
    resourceId:           state.resourceId,
    resourceType:         state.resourceType,
    timestamp:            state.timestamp,
  }
}

module.exports = { getPolicyCompliance }
