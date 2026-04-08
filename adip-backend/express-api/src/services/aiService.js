const fetch = require('node-fetch')

const ENDPOINT   = () => process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '')
const API_KEY    = () => process.env.AZURE_OPENAI_KEY
const DEPLOYMENT = () => process.env.AZURE_OPENAI_DEPLOYMENT || 'adip-gpt'
const API_VER    = '2024-10-21'

// ── chat START ──────────────────────────────────────────────────────────────
// Sends a chat completion request to Azure OpenAI and returns the response text
async function chat(systemPrompt, userContent, maxTokens = 400) {
  console.log('[chat] starts')
  if (!ENDPOINT() || !API_KEY()) {
    console.log('[chat] ends — no endpoint/key configured')
    throw new Error('Azure OpenAI not configured')
  }

  const url = `${ENDPOINT()}/openai/deployments/${DEPLOYMENT()}/chat/completions?api-version=${API_VER}`
  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': API_KEY() },
    body: JSON.stringify({
      messages:    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
      max_tokens:  maxTokens,
      temperature: 0.3,
    }),
  })
  if (!res.ok) {
    console.log('[chat] ends — API error')
    throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  const result = data.choices[0]?.message?.content?.trim() || ''
  console.log('[chat] ends')
  return result
}
// ── chat END ─────────────────────────────────────────────────────────────────


// ── explainDrift START ───────────────────────────────────────────────────────
// Feature 1: Natural Language Drift Explanation
// Sends drift changes to Azure OpenAI and returns a plain-English security explanation
async function explainDrift(record) {
  console.log('[explainDrift] starts')
  if (!ENDPOINT()) {
    console.log('[explainDrift] ends — no endpoint configured')
    return null
  }
  try {
    const changes = (record.differences || record.changes || [])
      .map(c => c.sentence || `${c.type} ${c.path}`)
      .slice(0, 15).join('\n')

    const result = await chat(
      'You are an Azure security expert. Explain this configuration drift in plain English in 3-4 sentences. Focus on security implications. No markdown, no bullet points.',
      `Resource: ${record.resourceId?.split('/').pop()} (type: ${record.resourceId?.split('/')[7] || 'unknown'})
Resource Group: ${record.resourceGroup}
Changes:\n${changes}`
    )
    console.log('[explainDrift] ends')
    return result
  } catch (e) {
    console.error('[AI explainDrift]', e.message)
    console.log('[explainDrift] ends — caught error')
    return null
  }
}
// ── explainDrift END ─────────────────────────────────────────────────────────


// ── reclassifySeverity START ─────────────────────────────────────────────────
// Feature 2: AI Severity Re-classification
// Sends changes to Azure OpenAI to get a severity rating that may override rule-based classification
async function reclassifySeverity(record) {
  console.log('[reclassifySeverity] starts')
  if (!ENDPOINT()) {
    console.log('[reclassifySeverity] ends — no endpoint configured')
    return null
  }
  try {
    const changes = (record.differences || record.changes || [])
      .map(c => c.sentence || `${c.type} ${c.path}: ${JSON.stringify(c.oldValue)} → ${JSON.stringify(c.newValue)}`)
      .slice(0, 10).join('\n')

    const response = await chat(
      'You are an Azure security expert. Classify drift severity. Respond ONLY with valid JSON: {"severity":"critical|high|medium|low","reasoning":"one sentence"}',
      `Resource type: ${record.resourceId?.split('/')[7] || 'unknown'}
Rule-based severity: ${record.severity}
Changes:\n${changes}`,
      150
    )
    const result = JSON.parse(response.replace(/```json|```/g, '').trim())
    console.log('[reclassifySeverity] ends')
    return result
  } catch (e) {
    console.error('[AI reclassify]', e.message)
    console.log('[reclassifySeverity] ends — caught error')
    return null
  }
}
// ── reclassifySeverity END ───────────────────────────────────────────────────


// ── getRemediationRecommendation START ───────────────────────────────────────
// Feature 3: Remediation Recommendation
// Returns an AI-generated explanation of what reverting to baseline will do and if it is safe
async function getRemediationRecommendation(record) {
  console.log('[getRemediationRecommendation] starts')
  if (!ENDPOINT()) {
    console.log('[getRemediationRecommendation] ends — no endpoint configured')
    return null
  }
  try {
    const changes = (record.differences || record.changes || [])
      .map(c => c.sentence || `${c.type} ${c.path}`)
      .slice(0, 10).join('\n')

    const result = await chat(
      'You are an Azure cloud architect. Give a 2-3 sentence remediation recommendation. Explain what reverting to baseline will do and whether it is safe. No markdown.',
      `Resource: ${record.resourceId?.split('/').pop()}
Changes to revert:\n${changes}`
    )
    console.log('[getRemediationRecommendation] ends')
    return result
  } catch (e) {
    console.error('[AI recommend]', e.message)
    console.log('[getRemediationRecommendation] ends — caught error')
    return null
  }
}
// ── getRemediationRecommendation END ─────────────────────────────────────────


// ── detectAnomalies START ────────────────────────────────────────────────────
// Feature 5: Anomaly Detection
// Analyses the last 50 drift records to surface unusual patterns in the drift history
async function detectAnomalies(driftRecords) {
  console.log('[detectAnomalies] starts')
  if (!ENDPOINT() || !driftRecords?.length) {
    console.log('[detectAnomalies] ends — no endpoint or empty records')
    return []
  }
  try {
    const summary = driftRecords.slice(0, 50).map(r => ({
      resource: r.resourceId?.split('/').pop() || 'unknown',
      rg:       r.resourceGroup,
      severity: r.severity,
      changes:  r.changeCount,
      time:     r.detectedAt,
      actor:    r.caller || r.actor || 'unknown',
    }))

    const response = await chat(
      'You are an Azure security analyst. Find anomalies in this drift history. Respond ONLY with valid JSON array (max 3 items): [{"title":"short title","description":"1-2 sentences","severity":"high|medium|low","affectedResource":"name"}]. Return [] if no anomalies.',
      JSON.stringify(summary),
      500
    )
    const parsed = JSON.parse(response.replace(/```json|```/g, '').trim())
    const result = Array.isArray(parsed) ? parsed : []
    console.log('[detectAnomalies] ends')
    return result
  } catch (e) {
    console.error('[AI anomalies]', e.message)
    console.log('[detectAnomalies] ends — caught error')
    return []
  }
}
// ── detectAnomalies END ──────────────────────────────────────────────────────

module.exports = { explainDrift, reclassifySeverity, getRemediationRecommendation, detectAnomalies }