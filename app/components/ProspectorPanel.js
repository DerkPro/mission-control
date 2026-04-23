'use client';
import { useState, useRef, useEffect } from 'react';
import { addContacts as storeAddContacts } from '../lib/store';

const INDUSTRIES = [
  'agriculture','automotive','banking','biotechnology','computer software','construction','consumer electronics',
  'e-commerce','education','energy & utilities','entertainment','financial services','food & beverages',
  'health care','hospitality','information technology & services','insurance','internet','legal services',
  'logistics & supply chain','manufacturing','marketing & advertising','media & communications',
  'mining & metals','nonprofit','oil & energy','pharmaceuticals','real estate','restaurants',
  'retail','semiconductors','staffing & recruiting','telecommunications','transportation','venture capital',
];

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia',
  'Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium',
  'Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria',
  'Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad',
  'Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic',
  'Denmark','Djibouti','Dominica','Dominican Republic','East Timor','Ecuador','Egypt','El Salvador',
  'Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon',
  'Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana',
  'Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
  'Ivory Coast','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan',
  'Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg',
  'Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius',
  'Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar',
  'Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea',
  'North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay',
  'Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis',
  'Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe',
  'Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia',
  'Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan',
  'Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Togo','Tonga',
  'Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine',
  'United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu',
  'Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
];

const ROLE_EMAILS = [
  { role: 'CEO', prefixes: ['ceo'] },
  { role: 'CTO', prefixes: ['cto'] },
  { role: 'CFO', prefixes: ['cfo'] },
  { role: 'Head of Sales', prefixes: ['sales', 'head.sales'] },
  { role: 'VP Marketing', prefixes: ['marketing', 'vp.marketing'] },
  { role: 'General Inquiry', prefixes: ['info', 'contact', 'hello'] },
];

const EMPLOYEE_RANGES = [
  { label: '1-10', value: '1,10' },
  { label: '11-50', value: '11,50' },
  { label: '51-200', value: '51,200' },
  { label: '201-1000', value: '201,1000' },
  { label: '1001-5000', value: '1001,5000' },
  { label: '5001-10000', value: '5001,10000' },
  { label: '10000+', value: '10001,1000000' },
];

const EMAIL_PATTERNS = [
  (f, l) => `${f}.${l}`,
  (f, l) => `${f[0]}${l}`,
  (f, l) => `${f}`,
  (f, l) => `${f}${l}`,
  (f, l) => `${f[0]}.${l}`,
  (f, l) => `${f}_${l}`,
  (f, l) => `${l}.${f}`,
  (f, l) => `${l}`,
  (f, l) => `${f}${l[0]}`,
];

function guessEmails(firstName, lastName, domain) {
  if (!firstName || !domain) return [];
  const f = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const l = (lastName || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!f) return [];
  return EMAIL_PATTERNS.map(fn => {
    try { return `${fn(f, l)}@${domain}`; } catch { return null; }
  }).filter(Boolean);
}

function OrgLogo({ src }) {
  if (!src) return null;
  /* eslint-disable-next-line @next/next/no-img-element */
  return <img src={src} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'contain', background: '#fff' }} />;
}

function LocationAutocomplete({ value, onChange }) {
  const [input, setInput] = useState(value);
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef(null);

  useEffect(() => { setInput(value); }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    setHighlightIndex(-1);
    if (val.trim().length === 0) { setSuggestions([]); setShowDropdown(false); onChange(''); return; }
    const lower = val.toLowerCase();
    const filtered = COUNTRIES.filter(c => c.toLowerCase().includes(lower));
    filtered.sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(lower) ? 0 : 1;
      const bStarts = b.toLowerCase().startsWith(lower) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.localeCompare(b);
    });
    setSuggestions(filtered.slice(0, 8));
    setShowDropdown(filtered.length > 0);
  };

  const handleSelect = (country) => { setInput(country); onChange(country); setShowDropdown(false); setSuggestions([]); };

  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (highlightIndex >= 0) handleSelect(suggestions[highlightIndex]); else if (suggestions.length === 1) handleSelect(suggestions[0]); }
    else if (e.key === 'Escape') setShowDropdown(false);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (input && !COUNTRIES.includes(input)) {
        const lower = input.toLowerCase();
        const match = COUNTRIES.find(c => c.toLowerCase().startsWith(lower));
        if (match) { setInput(match); onChange(match); }
      }
    }, 200);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input className="input" placeholder="Type country..." value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }} onBlur={handleBlur} autoComplete="off" />
      {showDropdown && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 1000, maxHeight: '220px', overflowY: 'auto', marginTop: '4px' }}>
          {suggestions.map((country, i) => (
            <div key={country} onMouseDown={() => handleSelect(country)} onMouseEnter={() => setHighlightIndex(i)}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', background: i === highlightIndex ? 'var(--accent)' : 'transparent', color: i === highlightIndex ? '#fff' : 'var(--text)' }}>
              {country}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProspectorPanel({ showToast, onDataChange }) {
  const [industry, setIndustry] = useState('');
  const [query, setQuery] = useState('');
  const [employees, setEmployees] = useState('');
  const [location, setLocation] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedOrgs, setSelectedOrgs] = useState(new Set());
  const [enrichedOrgs, setEnrichedOrgs] = useState({});
  const [enriching, setEnriching] = useState(null);
  const [showGenerate, setShowGenerate] = useState(null);
  const [genName, setGenName] = useState('');
  const [genTitle, setGenTitle] = useState('');
  const [generatedEmails, setGeneratedEmails] = useState([]);
  const [showBulkGenerate, setShowBulkGenerate] = useState(false);
  const [bulkContacts, setBulkContacts] = useState([]);
  const [bulkSelected, setBulkSelected] = useState(new Set());

  const handleSearch = async (p = 1) => {
    if (!industry && !query) return showToast('Select an industry or enter a company name', 'error');
    setSearching(true);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apollo_search', industry, query, employees, location, page: p, per_page: 25 }),
      });
      const data = await res.json();
      if (data.error) { showToast(data.error, 'error'); return; }
      setResults(data.organizations || []);
      setTotal(data.total || 0);
      setPage(data.page || 1);
      setTotalPages(data.totalPages || 0);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSearching(false); }
  };

  const handleEnrichOrg = async (org) => {
    if (!org.domain) return showToast('No domain available for this company', 'error');
    setEnriching(org.id);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apollo_enrich', domain: org.domain }),
      });
      const data = await res.json();
      if (data.error) { showToast(data.error, 'error'); return; }
      setEnrichedOrgs(prev => ({ ...prev, [org.id]: data }));
      showToast(`Enriched ${data.name}`);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setEnriching(null); }
  };

  const handleAddAsContact = (org) => {
    const enriched = enrichedOrgs[org.id];
    storeAddContacts([{
      email: enriched?.email || `info@${org.domain}`,
      firstName: org.name,
      lastName: '',
      company: org.name,
      companyDomain: org.domain,
      title: '',
      linkedin: org.linkedin,
      tags: [org.industry || 'prospected'],
      source: 'apollo',
    }]);
    showToast(`Added ${org.name} to contacts`);
    onDataChange?.();
  };

  const handleBulkAdd = () => {
    const orgs = results.filter(o => selectedOrgs.has(o.id));
    const contacts = orgs.map(o => ({
      email: `info@${o.domain}`,
      firstName: o.name,
      lastName: '',
      company: o.name,
      companyDomain: o.domain,
      linkedin: o.linkedin,
      tags: [o.industry || 'prospected'],
      source: 'apollo',
      employees: o.employees,
    }));
    const result = storeAddContacts(contacts);
    showToast(`Added ${result.added} companies (${result.duplicates} duplicates skipped)`);
    setSelectedOrgs(new Set());
    onDataChange?.();
  };

  const handleGenerateEmails = (org) => {
    if (!genName) return;
    const nameParts = genName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    const emails = guessEmails(firstName, lastName, org.domain);
    setGeneratedEmails(emails.map(e => ({ email: e, firstName, lastName, company: org.name, title: genTitle, domain: org.domain })));
  };

  const handleAddGeneratedContact = (contact) => {
    storeAddContacts([{
      email: contact.email,
      firstName: contact.firstName,
      lastName: contact.lastName,
      company: contact.company,
      title: contact.title,
      tags: ['prospected', 'email-guessed'],
      source: 'apollo-pattern',
    }]);
    showToast(`Added ${contact.firstName} ${contact.lastName} (${contact.email})`);
    onDataChange?.();
  };

  const handleBulkGenerate = () => {
    const orgs = selectedOrgs.size > 0 ? results.filter(o => selectedOrgs.has(o.id)) : results;
    const generated = [];
    orgs.forEach(org => {
      if (!org.domain) return;
      ROLE_EMAILS.forEach(({ role, prefixes }) => {
        prefixes.forEach(prefix => {
          generated.push({ email: `${prefix}@${org.domain}`, firstName: role, lastName: '', company: org.name, title: role, domain: org.domain, industry: org.industry });
        });
      });
    });
    setBulkContacts(generated);
    setBulkSelected(new Set(generated.map((_, i) => i)));
    setShowBulkGenerate(true);
  };

  const handleAddBulkContacts = () => {
    const toAdd = bulkContacts.filter((_, i) => bulkSelected.has(i));
    const result = storeAddContacts(toAdd.map(c => ({
      email: c.email, firstName: c.firstName, lastName: c.lastName, company: c.company, title: c.title,
      tags: ['prospected', 'bulk-generated'], source: 'apollo-bulk',
    })));
    showToast(`Added ${result.added} contacts (${result.duplicates} duplicates skipped)`);
    setShowBulkGenerate(false);
    setBulkContacts([]);
    setBulkSelected(new Set());
    onDataChange?.();
  };

  const toggleBulkItem = (i) => { const n = new Set(bulkSelected); n.has(i) ? n.delete(i) : n.add(i); setBulkSelected(n); };
  const toggleOrg = (id) => { const n = new Set(selectedOrgs); n.has(id) ? n.delete(id) : n.add(id); setSelectedOrgs(n); };

  return (
    <div>
      <div className="card-header">
        <div><h2 className="card-title">Prospector</h2><p className="card-subtitle">Search companies by industry and generate contact emails</p></div>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
            <label className="form-label">Industry</label>
            <select className="select" value={industry} onChange={e => setIndustry(e.target.value)}>
              <option value="">Select industry...</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
            <label className="form-label">Company Name (optional)</label>
            <input className="input" placeholder="e.g., Tesla, Google..." value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: '0 1 160px' }}>
            <label className="form-label">Employees</label>
            <select className="select" value={employees} onChange={e => setEmployees(e.target.value)}>
              <option value="">Any size</option>
              {EMPLOYEE_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: '0 1 200px' }}>
            <label className="form-label">Location</label>
            <LocationAutocomplete value={location} onChange={setLocation} />
          </div>
          <button className="btn btn-primary" onClick={() => handleSearch(1)} disabled={searching} style={{ height: '38px' }}>
            {searching ? <><span className="spinner" /> Searching...</> : 'Search'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-title">{total.toLocaleString()} Companies Found</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '12px' }}>Page {page} of {totalPages}</span>
            </div>
            <div className="btn-group">
              <button className="btn btn-sm btn-success" onClick={handleBulkGenerate}>Generate All Contacts{selectedOrgs.size > 0 ? ` (${selectedOrgs.size})` : ''}</button>
              {selectedOrgs.size > 0 && <button className="btn btn-sm btn-primary" onClick={handleBulkAdd}>Add {selectedOrgs.size} to Contacts</button>}
              {page > 1 && <button className="btn btn-sm btn-secondary" onClick={() => handleSearch(page - 1)}>Prev</button>}
              {page < totalPages && <button className="btn btn-sm btn-secondary" onClick={() => handleSearch(page + 1)}>Next</button>}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {results.map(org => (
              <div key={org.id} style={{ padding: '14px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: selectedOrgs.has(org.id) ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <input type="checkbox" checked={selectedOrgs.has(org.id)} onChange={() => toggleOrg(org.id)} />
                    <OrgLogo src={org.logo} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{org.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '12px', marginTop: '2px', flexWrap: 'wrap' }}>
                        {org.domain && <span>{org.domain}</span>}
                        {org.industry && <span className="badge badge-blue">{org.industry}</span>}
                        {org.employees && <span>{org.employees.toLocaleString()} employees</span>}
                        {org.location && <span>{org.location}</span>}
                        {org.founded && <span>Est. {org.founded}</span>}
                      </div>
                      {org.description && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{org.description.slice(0, 150)}{org.description.length > 150 ? '...' : ''}</div>}
                    </div>
                  </div>
                  <div className="btn-group" style={{ flexShrink: 0 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleEnrichOrg(org)} disabled={enriching === org.id}>
                      {enriching === org.id ? <span className="spinner" /> : enrichedOrgs[org.id] ? 'Enriched' : 'Enrich'}
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => { setShowGenerate(showGenerate === org.id ? null : org.id); setGenName(''); setGenTitle(''); setGeneratedEmails([]); }}>
                      Find Emails
                    </button>
                    <button className="btn btn-sm btn-primary" onClick={() => handleAddAsContact(org)}>Add</button>
                  </div>
                </div>

                {enrichedOrgs[org.id] && (
                  <div style={{ marginTop: '10px', padding: '10px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      {enrichedOrgs[org.id].phone && <span>Phone: <strong>{enrichedOrgs[org.id].phone}</strong></span>}
                      {enrichedOrgs[org.id].website && <span>Web: <strong>{enrichedOrgs[org.id].website}</strong></span>}
                      {enrichedOrgs[org.id].linkedin && <a href={enrichedOrgs[org.id].linkedin} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>LinkedIn</a>}
                    </div>
                    {enrichedOrgs[org.id].techStack?.length > 0 && (
                      <div style={{ marginTop: '6px' }}>Tech: {enrichedOrgs[org.id].techStack.map(t => <span key={t} className="tag" style={{ marginRight: '4px' }}>{t}</span>)}</div>
                    )}
                    {enrichedOrgs[org.id].keywords?.length > 0 && (
                      <div style={{ marginTop: '6px', color: 'var(--text-muted)' }}>Keywords: {enrichedOrgs[org.id].keywords.join(', ')}</div>
                    )}
                  </div>
                )}

                {showGenerate === org.id && (
                  <div style={{ marginTop: '10px', padding: '14px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>Generate Email for {org.name}</div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <input className="input" placeholder="Full name (e.g., John Smith)" value={genName} onChange={e => setGenName(e.target.value)} style={{ flex: 1 }} />
                      <input className="input" placeholder="Title (optional)" value={genTitle} onChange={e => setGenTitle(e.target.value)} style={{ flex: 1 }} />
                      <button className="btn btn-sm btn-primary" onClick={() => handleGenerateEmails(org)} disabled={!org.domain}>Generate</button>
                    </div>
                    {!org.domain && <p style={{ fontSize: '12px', color: 'var(--red)' }}>No domain available — cannot generate emails</p>}
                    {generatedEmails.length > 0 && (
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Possible email addresses (most common patterns):</div>
                        {generatedEmails.map((c, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-dim)', width: '20px' }}>#{i + 1}</span>
                              <span style={{ fontSize: '13px', fontFamily: 'monospace' }}>{c.email}</span>
                            </div>
                            <button className="btn btn-sm btn-success" onClick={() => handleAddGeneratedContact(c)}>Add to Contacts</button>
                          </div>
                        ))}
                        <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px' }}>#1 and #2 are the most common patterns. Use Verify All on Contacts page to check validity.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length === 0 && !searching && (
        <div className="card">
          <div className="empty-state">
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>Search for companies by industry</p>
            <p>Select an industry above and hit Search. You can then enrich companies, generate email addresses, and add them to your contacts.</p>
          </div>
        </div>
      )}

      {showBulkGenerate && (
        <div className="modal-overlay" onClick={() => setShowBulkGenerate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <h3 className="modal-title">Bulk Generate Decision-Maker Contacts</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Generated {bulkContacts.length} role-based emails for {new Set(bulkContacts.map(c => c.company)).size} companies.
              Uncheck any you don&apos;t want to add.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button className="btn btn-sm btn-secondary" onClick={() => setBulkSelected(new Set(bulkContacts.map((_, i) => i)))}>Select All</button>
              <button className="btn btn-sm btn-secondary" onClick={() => setBulkSelected(new Set())}>Deselect All</button>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', alignSelf: 'center' }}>{bulkSelected.size} selected</span>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '16px' }}>
              <table><thead><tr><th></th><th>Email</th><th>Role</th><th>Company</th></tr></thead>
                <tbody>{bulkContacts.map((c, i) => (
                  <tr key={i}>
                    <td><input type="checkbox" checked={bulkSelected.has(i)} onChange={() => toggleBulkItem(i)} /></td>
                    <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>{c.email}</td>
                    <td><span className="badge badge-blue">{c.title}</span></td>
                    <td style={{ fontSize: '12px' }}>{c.company}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={handleAddBulkContacts}>Add {bulkSelected.size} Contacts</button>
              <button className="btn btn-secondary" onClick={() => setShowBulkGenerate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
