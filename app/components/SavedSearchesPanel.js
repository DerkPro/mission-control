'use client';
import { useState } from 'react';
import { getSavedSearches, saveSavedSearches, useContacts, useSavedSearches } from '../lib/store';

export default function SavedSearchesPanel({ showToast }) {
  const searches = useSavedSearches();
  const contacts = useContacts();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [filters, setFilters] = useState({ search: '', tag: '', tier: '', verified: '', company: '' });
  const [activeSearch, setActiveSearch] = useState(null);

  const applyFilters = (f) => contacts.filter(c => {
    if (f.search && !`${c.firstName} ${c.lastName} ${c.email} ${c.company}`.toLowerCase().includes(f.search.toLowerCase())) return false;
    if (f.tag && !(c.tags || []).includes(f.tag)) return false;
    if (f.tier && c.leadTier !== f.tier) return false;
    if (f.verified && c.verified !== f.verified) return false;
    if (f.company && !(c.company || '').toLowerCase().includes(f.company.toLowerCase())) return false;
    return true;
  });

  const handleSave = () => {
    if (!name) return;
    const s = getSavedSearches();
    s.push({ id: crypto.randomUUID(), name, filters, createdAt: new Date().toISOString() });
    saveSavedSearches(s);
    setName('');
    setShowCreate(false);
    showToast('Smart list saved');
  };

  const handleDelete = (id) => {
    saveSavedSearches(getSavedSearches().filter(search => search.id !== id));
    if (activeSearch?.id === id) setActiveSearch(null);
    showToast('Smart list deleted');
  };

  const allTags = [...new Set(contacts.flatMap(c => c.tags || []))];
  const previewResults = activeSearch ? applyFilters(activeSearch.filters) : [];

  return (
    <div>
      <div className="card-header"><div><h2 className="card-title">Smart Lists</h2><p className="card-subtitle">Save search filters for quick access to contact segments</p></div><button className="btn btn-primary" onClick={() => setShowCreate(true)}>New Smart List</button></div>
      <div className="grid-2">
        <div>
          {searches.length === 0 ? <div className="card"><div className="empty-state"><p>No smart lists yet.</p></div></div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {searches.map(s => { const matched = applyFilters(s.filters); return (
                <div key={s.id} className="card" style={{ cursor: 'pointer', border: activeSearch?.id === s.id ? '1px solid var(--accent)' : undefined }} onClick={() => setActiveSearch(s)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ fontWeight: 600, fontSize: '14px' }}>{s.name}</div><div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{matched.length} contacts match</div></div><button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}>Delete</button></div>
                </div>
              ); })}
            </div>
          )}
        </div>
        <div className="card">
          {activeSearch ? (<><h3 className="card-title" style={{ marginBottom: '12px' }}>{activeSearch.name} ({previewResults.length})</h3><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Tier</th></tr></thead><tbody>{previewResults.slice(0, 50).map(c => (<tr key={c.id}><td>{c.firstName} {c.lastName}</td><td style={{ fontSize: '12px' }}>{c.email}</td><td>{c.company || '-'}</td><td>{c.leadTier ? <span className={`badge badge-${c.leadTier === 'hot' ? 'red' : c.leadTier === 'warm' ? 'orange' : 'blue'}`}>{c.leadTier}</span> : '-'}</td></tr>))}</tbody></table></div></>) : <div className="empty-state"><p>Select a smart list to preview</p></div>}
        </div>
      </div>
      {showCreate && (<div className="modal-overlay" onClick={() => setShowCreate(false)}><div className="modal" onClick={e => e.stopPropagation()}><h3 className="modal-title">Create Smart List</h3>
        <div className="form-group"><label className="form-label">List Name</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Hot Leads" /></div>
        <div className="form-group"><label className="form-label">Search Text</label><input className="input" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} /></div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">Tag</label><select className="select" value={filters.tag} onChange={e => setFilters({ ...filters, tag: e.target.value })}><option value="">Any</option>{allTags.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Lead Tier</label><select className="select" value={filters.tier} onChange={e => setFilters({ ...filters, tier: e.target.value })}><option value="">Any</option><option value="hot">Hot</option><option value="warm">Warm</option><option value="cool">Cool</option><option value="cold">Cold</option></select></div>
          <div className="form-group"><label className="form-label">Verified</label><select className="select" value={filters.verified} onChange={e => setFilters({ ...filters, verified: e.target.value })}><option value="">Any</option><option value="valid">Valid</option><option value="risky">Risky</option><option value="invalid">Invalid</option></select></div>
          <div className="form-group"><label className="form-label">Company</label><input className="input" value={filters.company} onChange={e => setFilters({ ...filters, company: e.target.value })} /></div>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Preview: {applyFilters(filters).length} contacts match</p>
        <div className="btn-group"><button className="btn btn-primary" onClick={handleSave}>Save</button><button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button></div>
      </div></div>)}
    </div>
  );
}
