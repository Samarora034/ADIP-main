import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { diff as deepDiff } from 'deep-diff'
import Sidebar from '../components/Sidebar'
import JsonTree from '../components/JsonTree'
import { fetchBaseline, remediateToBaseline, fetchPolicyCompliance } from '../services/api'
import './ComparisonPage.css'

// ── Severity classifier ────────────────────────────────────────────────────
const CRITICAL_PATHS = [
  'properties.networkAcls', 'properties.accessPolicies', 'properties.securityRules',
  'sku', 'location', 'identity', 'properties.encryption',
]

function classifySeverity(differences) {
  if (!differences.length) return null
  if (differences.some(d => d.type === 'removed')) return 'critical'
  if (differences.some(d => CRITICAL_PATHS.some(p => d.path.startsWith(p)))) return 'high'
  if (differences.length > 5) return 'medium'
  return 'low'
}

// ── Normalise deep-diff output into readable change entries ─────────────────
function formatDifferences(rawDiff) {
  if (!rawDiff) return []
  return rawDiff.map(d => {
    const path = d.path?.join(' → ') ?? '(root)'
    switch (d.kind) {
      case 'N': return { path, type: 'added',   label: 'Added',    newValue: d.rhs }
      case 'D': return { path, type: 'removed', label: 'Removed',  oldValue: d.lhs }
      case 'E': return { path, type: 'changed', label: 'Modified', oldValue: d.lhs, newValue: d.rhs }
      case 'A': return { path: `${path}[${d.index}]`, type: 'array', label: 'Array changed', oldValue: d.item?.lhs, newValue: d.item?.rhs }
      default:  return null
    }
  }).filter(Boolean)
}

// Strip volatile fields before diffing (same list as the backend Function App)
function normaliseState(state) {
  if (!state) return {}
  const VOLATILE = ['etag', 'changedTime', 'createdTime', 'provisioningState', 'lastModifiedAt', 'systemData', '_ts', '_etag', '_rid', '_self']
  const strip = (obj) => {
    if (Array.isArray(obj)) return obj.map(strip)
    if (obj && typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj).filter(([k]) => !VOLATILE.includes(k)).map(([k, v]) => [k, strip(v)])
      )
    }
    return obj
  }
  return strip(JSON.parse(JSON.stringify(state)))
}

// ── Value display helper ────────────────────────────────────────────────────
function ValueChip({ value, variant }) {
  const display = value === undefined ? '—' : JSON.stringify(value)
  return <span className={`value-chip value-chip--${variant}`}>{display}</span>
}

export default function ComparisonPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const state     = location.state ?? {}

  const { subscriptionId, resourceGroupId, resourceId, resourceName, liveState: passedLive } = state

  const [baseline,       setBaseline]       = useState(null)
  const [differences,    setDifferences]    = useState([])
  const [severity,       setSeverity]       = useState(null)
  const [loading,        setLoading]        = useState(false)
  const [noBaseline,     setNoBaseline]     = useState(false)
  const [remediating,    setRemediating]    = useState(false)
  const [remediated,     setRemediated]     = useState(false)
  const [remediateErr,   setRemediateErr]   = useState(null)
  const [remediateDiff,  setRemediateDiff]  = useState(null)
  const [policyData,     setPolicyData]     = useState(null)

  const baselineTreeRef = useRef(null)
  const liveTreeRef     = useRef(null)

  // Load baseline from Cosmos DB via backend
  useEffect(() => {
    if (!subscriptionId) return
    const load = async () => {
      setLoading(true)
      // Fetch baseline and policy compliance in parallel
      fetchPolicyCompliance(subscriptionId, resourceGroupId, resourceId).then(setPolicyData).catch(() => {})
      try {
        const data = await fetchBaseline(subscriptionId, resourceId)
        if (data?.resourceState) {
          const normBaseline = normaliseState(data.resourceState)
          const normLive     = normaliseState(passedLive)
          setBaseline(normBaseline)
          const rawDiff = deepDiff(normBaseline, normLive) || []
          const fmtDiff = formatDifferences(rawDiff)
          setDifferences(fmtDiff)
          setSeverity(classifySeverity(fmtDiff))
        } else {
          setNoBaseline(true)
        }
      } catch {
        setNoBaseline(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [subscriptionId, resourceId])

  const handleRemediate = async () => {
    setRemediating(true)
    setRemediateErr(null)
    setRemediateDiff(null)
    try {
      // Show what will be reverted: diff is baseline → live (what changed FROM baseline)
      // We display this as "these fields will be reset to baseline values"
      const normBaseline = baseline
      const normLive     = normaliseState(passedLive)
      const rawDiff      = deepDiff(normBaseline || {}, normLive) || []
      setRemediateDiff(formatDifferences(rawDiff))

      await remediateToBaseline(subscriptionId, resourceGroupId, resourceId)
      setRemediated(true)
    } catch (err) {
      setRemediateErr(err.message)
    } finally {
      setRemediating(false)
    }
  }

  const expandAll  = useCallback(() => { baselineTreeRef.current?.expandAll();  liveTreeRef.current?.expandAll()  }, [])
  const collapseAll = useCallback(() => { baselineTreeRef.current?.collapseAll(); liveTreeRef.current?.collapseAll() }, [])

  // Guard: no state passed (direct URL navigation)
  if (!subscriptionId || !passedLive) {
    return (
      <div className="dashboard">
        <Sidebar />
        <div className="dashboard-main-wrapper">
          <div className="comparison-no-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ct-grey-300)" strokeWidth="1.5"><path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5"/></svg>
            <p>No comparison data available. Please navigate here from the Drift Scanner.</p>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => navigate('/dashboard')}>
              ← Go to Drift Scanner
            </button>
          </div>
        </div>
      </div>
    )
  }

  const displayName = resourceName ?? resourceId?.split('/').pop() ?? resourceGroupId

  return (
    <div className="dashboard">
      <Sidebar />

      <div className="dashboard-main-wrapper">
        {/* Navbar */}
        <nav className="dashboard-nav">
          <div className="dashboard-nav-left">
            <button className="back-btn" onClick={() => navigate('/dashboard')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
            <div className="dashboard-nav-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ct-coral-blue)" strokeWidth="2"><path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              <span>Baseline Comparison</span>
            </div>
            <div className="comparison-breadcrumb">
              <span>{subscriptionId}</span>
              <span className="breadcrumb-sep">›</span>
              <span>{resourceGroupId}</span>
              <span className="breadcrumb-sep">›</span>
              <span className="breadcrumb-active">{displayName}</span>
            </div>
          </div>
          <div className="dashboard-nav-right">
            {severity && (
              <span className={`severity-badge severity-badge--${severity}`}>
                {severity.toUpperCase()}
              </span>
            )}
            {policyData && policyData.summary !== 'no-policies' && (
              <span className={`severity-badge severity-badge--${policyData.nonCompliant > 0 ? 'critical' : 'none'}`}
                title={policyData.nonCompliant > 0 ? `${policyData.nonCompliant} policy violation(s)` : 'Policy compliant'}>
                {policyData.nonCompliant > 0 ? `POLICY: ${policyData.nonCompliant} VIOLATION(S)` : 'POLICY: COMPLIANT'}
              </span>
            )}
            {differences.length > 0 && !noBaseline && (
              <button
                className="btn btn-promote"
                onClick={handleRemediate}
                disabled={remediating || remediated}
              >
                {remediating ? (
                  <><div className="btn-spinner btn-spinner--dark" /><span>Remediating...</span></>
                ) : remediated ? (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg><span>Remediated!</span></>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14l-4-4 4-4"/><path d="M5 10h11a4 4 0 0 1 0 8h-1"/></svg><span>Remediate to Baseline</span></>
                )}
              </button>
            )}
          </div>
        </nav>

        {/* Body */}
        <div className="comparison-body">

          {/* Promote error */}
          {remediateErr && (
            <div className="comparison-alert comparison-alert--error">
              Failed to remediate: {remediateErr}
            </div>
          )}

          {/* Promote diff output */}
          {remediated && remediateDiff !== null && (
            <div className="comparison-alert comparison-alert--success">
              <strong>✓ Remediated — live resource reverted to golden baseline.</strong>
              {remediateDiff.length === 0 ? (
                <span> Live state already matched the golden baseline — no changes needed.</span>
              ) : (
                <>
                  <span> {remediateDiff.length} field(s) reverted to golden baseline values:</span>
                  <div className="changes-list" style={{ marginTop: 8 }}>
                    {remediateDiff.map((d, i) => (
                      <div key={i} className={`change-entry change-entry--${d.type}`}>
                        <div className="change-entry-header">
                          <span className={`change-kind-badge change-kind-badge--${d.type}`}>{d.label}</span>
                          <code className="change-path">{d.path}</code>
                        </div>
                        <div className="change-values">
                          {d.oldValue !== undefined && <ValueChip value={d.oldValue} variant="old" />}
                          {d.oldValue !== undefined && d.newValue !== undefined && <span className="change-arrow">→</span>}
                          {d.newValue !== undefined && <ValueChip value={d.newValue} variant="new" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="comparison-loading">
              <div className="scanning-ring" style={{ width: 32, height: 32, border: '2px solid rgba(25,149,255,0.15)', borderTopColor: 'var(--ct-coral-blue)' }} />
              <span>Loading golden baseline from Cosmos DB...</span>
            </div>
          )}

          {/* No baseline */}
          {!loading && noBaseline && (
            <div className="panel comparison-no-baseline-panel">
              <div className="panel-body">
                <div className="panel-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ct-grey-300)" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  <p>No golden baseline found for <strong>{displayName}</strong>.</p>
                  <p style={{ fontSize: 12 }}>Promote the current live state as the first baseline to begin drift tracking.</p>
                  <button
                    className="btn btn-promote"
                    style={{ width: 'auto', marginTop: 8 }}
                    onClick={handleRemediate}
                    disabled={remediating || remediated}
                  >
                    {remediating ? 'Remediating...' : remediated ? '✓ Remediated!' : 'No baseline found — seed one first'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Change summary */}
          {!loading && baseline && (
            <section className="panel comparison-changes-panel">
              <div className="panel-header">
                <div className="panel-header-left">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ct-coral-blue)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <h3>{differences.length === 0 ? 'In sync with baseline' : `Changes detected (${differences.length})`}</h3>
                </div>
                {differences.length === 0 && (
                  <span className="in-sync-badge">✓ No drift</span>
                )}
              </div>

              {differences.length > 0 && (
                <div className="panel-body comparison-changes-body">
                  <div className="changes-list">
                    {differences.map((d, i) => (
                      <div key={`${d.path}-${i}`} className={`change-entry change-entry--${d.type}`}>
                        <div className="change-entry-header">
                          <span className={`change-kind-badge change-kind-badge--${d.type}`}>{d.label}</span>
                          <code className="change-path">{d.path}</code>
                        </div>
                        <div className="change-values">
                          {d.oldValue !== undefined && (
                            <ValueChip value={d.oldValue} variant="old" />
                          )}
                          {d.oldValue !== undefined && d.newValue !== undefined && (
                            <span className="change-arrow">→</span>
                          )}
                          {d.newValue !== undefined && (
                            <ValueChip value={d.newValue} variant="new" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Side-by-side JSON panels */}
          {!loading && (baseline || passedLive) && (
            <div className="comparison-json-panels">
              {/* Global expand/collapse */}
              <div className="comparison-json-controls">
                <button className="panel-action-btn" onClick={expandAll}>Expand all</button>
                <button className="panel-action-btn" onClick={collapseAll}>Collapse all</button>
              </div>

              {/* Baseline panel */}
              <section className="panel comparison-json-panel">
                <div className="panel-header">
                  <div className="panel-header-left">
                    <div className="panel-dot panel-dot--baseline" />
                    <h3>Golden Baseline</h3>
                  </div>
                  {baseline && (
                    <span className="panel-badge panel-badge--baseline">Cosmos DB</span>
                  )}
                </div>
                <div className="panel-body panel-body-json">
                  {baseline
                    ? <JsonTree ref={baselineTreeRef} data={baseline} />
                    : <div className="panel-empty"><p>No baseline stored</p></div>
                  }
                </div>
              </section>

              {/* Live state panel */}
              <section className="panel comparison-json-panel">
                <div className="panel-header">
                  <div className="panel-header-left">
                    <div className="panel-dot panel-dot--live" />
                    <h3>Live State</h3>
                  </div>
                  <span className="panel-badge panel-badge--live">ARM</span>
                </div>
                <div className="panel-body panel-body-json">
                  <JsonTree ref={liveTreeRef} data={normaliseState(passedLive)} />
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}