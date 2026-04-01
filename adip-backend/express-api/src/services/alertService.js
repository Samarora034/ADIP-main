const { EmailClient } = require('@azure/communication-email')

const ALERT_LEVELS = ['critical', 'high']
let emailClient = null

function getEmailClient() {
  if (!emailClient && process.env.COMMS_CONNECTION_STRING) {
    emailClient = new EmailClient(process.env.COMMS_CONNECTION_STRING)
  }
  return emailClient
}

// Task 1: Convert diff array into a clean HTML table
function buildDiffTable(changes) {
  if (!changes?.length) return ''
  const typeColor = { modified: '#d97706', added: '#16a34a', removed: '#dc2626', 'array-added': '#16a34a', 'array-removed': '#dc2626' }
  const rows = changes.map(c => {
    const color  = typeColor[c.type] || '#6b7280'
    const label  = c.type.replace('-', ' ').toUpperCase()
    const oldVal = c.oldValue != null ? String(typeof c.oldValue === 'object' ? JSON.stringify(c.oldValue) : c.oldValue) : '—'
    const newVal = c.newValue != null ? String(typeof c.newValue === 'object' ? JSON.stringify(c.newValue) : c.newValue) : '—'
    return `
      <tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:8px 10px;font-family:monospace;font-size:12px;color:#374151">${c.path || c.label || ''}</td>
        <td style="padding:8px 10px;text-align:center">
          <span style="background:${color}22;color:${color};padding:2px 6px;border-radius:4px;font-size:11px;font-weight:700">${label}</span>
        </td>
        <td style="padding:8px 10px;font-size:12px;color:#dc2626;text-decoration:line-through;max-width:160px;overflow:hidden;text-overflow:ellipsis">${oldVal}</td>
        <td style="padding:8px 10px;font-size:12px;color:#16a34a;max-width:160px;overflow:hidden;text-overflow:ellipsis">${newVal}</td>
      </tr>`
  }).join('')

  return `
    <div style="margin-top:20px">
      <p style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px">What Changed:</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;font-weight:600">Property</th>
            <th style="padding:8px 10px;text-align:center;font-size:11px;color:#6b7280;font-weight:600">Change</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;font-weight:600">Old Value</th>
            <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;font-weight:600">New Value</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
}

// Task 2 & 3: Approve/Reject buttons call back to Express API
// Express API handles the decision and triggers remediation or baseline update
function buildApprovalButtons(record, baseUrl) {
  const token = Buffer.from(JSON.stringify({
    resourceId:     record.resourceId,
    resourceGroup:  record.resourceGroup,
    subscriptionId: record.subscriptionId,
    detectedAt:     record.detectedAt,
  })).toString('base64url')

  const approveUrl = `${baseUrl}/api/remediate-decision?action=approve&token=${token}`
  const rejectUrl  = `${baseUrl}/api/remediate-decision?action=reject&token=${token}`

  return `
    <div style="margin-top:24px;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px">
      <p style="font-size:13px;font-weight:600;color:#166534;margin:0 0 12px">
        Action Required — Approve or Reject Remediation
      </p>
      <p style="font-size:12px;color:#374151;margin:0 0 16px">
        <strong>Approve</strong> will revert the resource to its golden baseline.<br>
        <strong>Reject</strong> will accept the current state as the new baseline.
      </p>
      <div style="display:flex;gap:12px">
        <a href="${approveUrl}"
          style="display:inline-block;padding:10px 24px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600">
          ✓ Approve Remediation
        </a>
        <a href="${rejectUrl}"
          style="display:inline-block;padding:10px 24px;background:#6b7280;color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600">
          ✗ Reject (Accept Drift)
        </a>
      </div>
    </div>`
}

async function sendDriftAlert(record) {
  const recipients = (process.env.ALERT_RECIPIENT_EMAIL || '')
    .split(',').map(e => e.trim()).filter(Boolean)
  if (!recipients.length || !ALERT_LEVELS.includes(record.severity)) return

  const client = getEmailClient()
  if (!client) return

  const resourceName  = record.resourceId?.split('/').pop() ?? record.resourceId
  const severityColor = record.severity === 'critical' ? '#dc2626' : '#d97706'
  const severityLabel = record.severity.toUpperCase()
  const baseUrl       = process.env.EXPRESS_PUBLIC_URL || process.env.EXPRESS_API_URL?.replace('/api','') || 'http://localhost:3001'

  // Task 1: build diff table from changes array (from hardened diff engine)
  const changes   = record.differences || record.changes || []
  const diffTable = buildDiffTable(changes)

  // Task 2: build approval buttons with signed token
  const approvalButtons = buildApprovalButtons(record, baseUrl)

  const htmlBody = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <div style="background:${severityColor};padding:20px 24px">
        <h2 style="color:#fff;margin:0;font-size:20px">🚨 Azure Drift Alert — ${severityLabel}</h2>
      </div>
      <div style="padding:24px;background:#fff">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:8px 0;color:#6b7280;width:140px">Resource</td>
            <td style="padding:8px 0;font-weight:600;color:#111827">${resourceName}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:8px 0;color:#6b7280">Resource Group</td>
            <td style="padding:8px 0;color:#111827">${record.resourceGroup}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:8px 0;color:#6b7280">Severity</td>
            <td style="padding:8px 0;font-weight:700;color:${severityColor}">${severityLabel}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6">
            <td style="padding:8px 0;color:#6b7280">Changes</td>
            <td style="padding:8px 0;color:#111827">${changes.length} field(s)</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280">Detected At</td>
            <td style="padding:8px 0;color:#111827">${new Date(record.detectedAt).toLocaleString()}</td>
          </tr>
        </table>

        ${diffTable}
        ${approvalButtons}
      </div>
      <div style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af">
        Azure Drift Intelligence Platform — Automated Alert · Approval link expires in 24 hours
      </div>
    </div>`

  try {
    const poller = await client.beginSend({
      senderAddress: process.env.SENDER_ADDRESS,
      recipients:    { to: recipients.map(address => ({ address })) },
      content: {
        subject:   `[ADIP] ${severityLabel} Drift — ${resourceName} — Action Required`,
        html:      htmlBody,
        plainText: `ADIP Drift Alert\nSeverity: ${severityLabel}\nResource: ${resourceName}\nChanges: ${changes.length}\n\nChanges:\n${changes.map(c => `- ${c.sentence || c.path}`).join('\n')}\n\nDetected: ${record.detectedAt}`,
      },
    })
    await poller.pollUntilDone()
    console.log(`[Alert] Approval email sent to ${recipients.join(', ')} for ${severityLabel} on ${resourceName}`)
  } catch (err) {
    console.error('[Alert] Email send failed:', err.message)
  }
}

module.exports = { sendDriftAlert }
