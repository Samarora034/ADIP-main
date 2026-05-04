import sys

file_path = 'src/pages/DriftScanner.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

config_old = """                {isMultiScope && isSubmitted && (
                  <select className="ds-filter-select" style={{ margin: '8px 12px', width: 'calc(100% - 24px)' }}
                    value={selectedScopeId || ''}
                    onChange={e => {
                      setSelectedScopeId(e.target.value)
                      const s = scopes.find(sc => (sc.resourceId || sc.resourceGroupId) === e.target.value)
                      if (s) fetchResourceConfiguration(s.subscriptionId, s.resourceGroupId, s.resourceId || null)
                        .then(cfg => { if (cfg) setConfigData(cfg) }).catch(() => {})
                    }}>
                    {scopes.filter(s => s.resourceGroupId).map(s => (
                      <option key={s.resourceId || s.resourceGroupId} value={s.resourceId || s.resourceGroupId}>
                        {s.resourceId ? s.resourceId.split('/').pop() : s.resourceGroupId}
                      </option>
                    ))}
                  </select>
                )}"""

config_new = """                {isMultiScope && isSubmitted && (
                  <div style={{ margin: '8px 12px', width: 'calc(100% - 24px)', zIndex: 10 }}>
                    <MultiSelectDropdown
                      options={scopes.filter(s => s.resourceGroupId).map(s => ({
                        value: s.resourceId || s.resourceGroupId,
                        label: s.resourceId ? s.resourceId.split('/').pop() : s.resourceGroupId
                      }))}
                      selected={selectedScopeId ? [selectedScopeId] : []}
                      onChange={val => {
                        const newId = val[0] || ''
                        setSelectedScopeId(newId)
                        const s = scopes.find(sc => (sc.resourceId || sc.resourceGroupId) === newId)
                        if (s) fetchResourceConfiguration(s.subscriptionId, s.resourceGroupId, s.resourceId || null)
                          .then(cfg => { if (cfg) setConfigData(cfg) }).catch(() => {})
                      }}
                      placeholder="Select a scope..."
                      singleSelect={true}
                    />
                  </div>
                )}"""

graph_old = """                {isMultiScope && isSubmitted && (
                  <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 20 }}>
                    <select className="ds-filter-select"
                      value={selectedScopeId || ''}
                      onChange={e => setSelectedScopeId(e.target.value)}>
                      {[...new Set(scopes.filter(s => s.resourceGroupId).map(s => s.resourceGroupId))].map(rg => (
                        <option key={rg} value={rg}>{rg}</option>
                      ))}
                    </select>
                  </div>
                )}"""

graph_new = """                {isMultiScope && isSubmitted && (
                  <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 20, width: 250 }}>
                    <MultiSelectDropdown
                      options={[...new Set(scopes.filter(s => s.resourceGroupId).map(s => s.resourceGroupId))].map(rg => ({
                        value: rg, label: rg
                      }))}
                      selected={selectedScopeId ? [selectedScopeId] : []}
                      onChange={val => setSelectedScopeId(val[0] || '')}
                      placeholder="Select Resource Group"
                      singleSelect={true}
                    />
                  </div>
                )}"""

if '\r\n' in content:
    config_old = config_old.replace('\n', '\r\n')
    config_new = config_new.replace('\n', '\r\n')
    graph_old = graph_old.replace('\n', '\r\n')
    graph_new = graph_new.replace('\n', '\r\n')

content = content.replace(config_old, config_new)
content = content.replace(graph_old, graph_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
