import sys

def process_file(file_path, old_str, new_str, import_str):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    if '\r\n' in content:
        old_str = old_str.replace('\n', '\r\n')
        new_str = new_str.replace('\n', '\r\n')
    
    if old_str in content:
        content = content.replace(old_str, new_str)
        # Add import if not present
        if 'import MultiSelectDropdown' not in content:
            content = content.replace("import JsonTree from '../components/JsonTree'", "import JsonTree from '../components/JsonTree'\n" + import_str)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {file_path}")
    else:
        print(f"Old string not found in {file_path}")

cp_old = """            <select className="cp-btn cp-btn--secondary" style={{ width: '100%', cursor: 'pointer' }}
              value={activeScopeIdx}
              onChange={e => { setActiveScopeIdx(Number(e.target.value)); aiExplainedRef.current = false }}>
              {multiScopes.map((s, i) => (
                <option key={i} value={i}>
                  {s.resourceId ? s.resourceId.split('/').pop() : `${s.resourceGroupId} (all resources)`}
                </option>
              ))}
            </select>"""

cp_new = """            <MultiSelectDropdown
              options={multiScopes.map((s, i) => ({
                value: i,
                label: s.resourceId ? s.resourceId.split('/').pop() : `${s.resourceGroupId} (all resources)`
              }))}
              selected={activeScopeIdx !== null ? [activeScopeIdx] : []}
              onChange={val => {
                if(val.length) {
                  setActiveScopeIdx(Number(val[0]))
                  aiExplainedRef.current = false
                }
              }}
              placeholder="Select a scope..."
              singleSelect={true}
            />"""

gp_old = """              <select className="gp-btn" style={{ cursor: "pointer", minWidth: 180 }}
                value={activeScopeIdx} onChange={e => setActiveScopeIdx(Number(e.target.value))}>
                {multiScopes.map((s, i) => (
                  <option key={i} value={i}>
                    {s.resourceId ? s.resourceId.split("/").pop() : `${s.resourceGroupId} (all resources)`}
                  </option>
                ))}
              </select>"""

gp_new = """              <div style={{ minWidth: 200, zIndex: 10 }}>
                <MultiSelectDropdown
                  options={multiScopes.map((s, i) => ({
                    value: i,
                    label: s.resourceId ? s.resourceId.split("/").pop() : `${s.resourceGroupId} (all resources)`
                  }))}
                  selected={activeScopeIdx !== null ? [activeScopeIdx] : []}
                  onChange={val => {
                    if(val.length) setActiveScopeIdx(Number(val[0]))
                  }}
                  placeholder="Select a scope..."
                  singleSelect={true}
                />
              </div>"""

process_file('src/pages/ComparisonPage.jsx', cp_old, cp_new, "import MultiSelectDropdown from '../components/MultiSelectDropdown'")
process_file('src/pages/GenomePage.jsx', gp_old, gp_new, "import MultiSelectDropdown from '../components/MultiSelectDropdown'")
