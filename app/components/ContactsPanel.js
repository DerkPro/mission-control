'use client';
import { useRef, useState } from 'react';
import { getSentEmails, saveContacts, addContacts as storeAddContacts, saveSentEmails, saveReplyStatuses, useContacts, useReplyStatuses } from '../lib/store';

function validateEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function verifyEmail(email) {
  const disposable = ['tempmail.com','throwaway.email','guerrillamail.com','mailinator.com','yopmail.com'];
  const domain = email.split('@')[1]?.toLowerCase() || '';
  const local = email.split('@')[0]?.toLowerCase() || '';
  const typos = { 'gmial.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmai.com': 'gmail.com', 'hotmial.com': 'hotmail.com', 'yahooo.com': 'yahoo.com', 'outlok.com': 'outlook.com' };
  let score = 100, reasons = [], status = 'valid';
  if (!validateEmailFormat(email)) { return { status: 'invalid', score: 0, reasons: ['Invalid format'] }; }
  if (disposable.includes(domain)) { score = 30; reasons.push('Disposable email'); }
  if (typos[domain]) { score = Math.min(score, 50); reasons.push(`Possible typo: did you mean ${typos[domain]}?`); }
  if (['info','admin','support','sales','contact','hello','team','noreply','no-reply'].includes(local)) { score = Math.min(score, 60); reasons.push('Role-based address'); }
  status = score >= 80 ? 'valid' : score >= 50 ? 'risky' : 'invalid';
  return { status, score, reasons };
}

function enrichContact(c) {
  const [local, domain] = (c.email || '').split('@');
  const domainName = domain?.split('.')[0] || '';
  const freeProviders = ['gmail','yahoo','hotmail','outlook','aol','icloud','protonmail','zoho'];
  const isPersonal = freeProviders.includes(domainName.toLowerCase());
  const nameParts = (local || '').replace(/[._-]/g, ' ').replace(/\d+/g, '').trim().split(' ').filter(Boolean);
  return {
    ...c,
    enriched: true,
    enrichedAt: new Date().toISOString(),
    firstName: c.firstName || (nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : ''),
    lastName: c.lastName || (nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : ''),
    company: c.company || (isPersonal ? '' : domainName.charAt(0).toUpperCase() + domainName.slice(1)),
    isPersonalEmail: isPersonal,
  };
}

function scoreContact(c, sentEmails) {
  let score = 0;
  if (c.verified === 'valid') score += 25; else if (c.verified === 'risky') score += 10; else if (c.email) score += 15;
  if (c.firstName) score += 5; if (c.lastName) score += 5; if (c.company) score += 5; if (c.title) score += 5;
  const emailsTo = sentEmails.filter(e => e.to?.toLowerCase() === c.email?.toLowerCase());
  if (emailsTo.length > 0) score += 5;
  if (emailsTo.some(e => e.opened)) score += 10;
  if (emailsTo.some(e => e.replied)) score += 15;
  if (c.addedAt) {
    const days = (Date.now() - new Date(c.addedAt).getTime()) / 86400000;
    if (days < 7) score += 15; else if (days < 30) score += 10; else if (days < 90) score += 5;
  }
  if (c.tags?.length > 0) score += Math.min(c.tags.length * 3, 10);
  score = Math.min(score, 100);
  const tier = score >= 80 ? 'hot' : score >= 50 ? 'warm' : score >= 25 ? 'cool' : 'cold';
  return { ...c, leadScore: score, leadTier: tier, scoredAt: new Date().toISOString() };
}

export default function ContactsPanel({ showToast, onDataChange }) {
  const contacts = useContacts();
  const replyStatuses = useReplyStatuses();
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showScrape, setShowScrape] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [checkingReplies, setCheckingReplies] = useState(false);
  const fileRef = useRef(null);

  const handleImportCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return showToast('CSV file is empty', 'error');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      const emailIdx = headers.findIndex(h => h.includes('email'));
      const nameIdx = headers.findIndex(h => h.includes('name') && !h.includes('last') && !h.includes('company'));
      const firstIdx = headers.findIndex(h => h.includes('first'));
      const lastIdx = headers.findIndex(h => h.includes('last'));
      const companyIdx = headers.findIndex(h => h.includes('company') || h.includes('organization'));
      const titleIdx = headers.findIndex(h => h.includes('title') || h.includes('position'));
      const linkedinIdx = headers.findIndex(h => h.includes('linkedin'));

      const newContacts = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
        const email = emailIdx >= 0 ? vals[emailIdx] : '';
        if (!email || !email.includes('@')) continue;
        const fullName = nameIdx >= 0 ? vals[nameIdx] : '';
        const nameParts = fullName.split(' ');
        newContacts.push({
          email,
          firstName: firstIdx >= 0 ? vals[firstIdx] : nameParts[0] || '',
          lastName: lastIdx >= 0 ? vals[lastIdx] : nameParts.slice(1).join(' ') || '',
          company: companyIdx >= 0 ? vals[companyIdx] : '',
          title: titleIdx >= 0 ? vals[titleIdx] : '',
          linkedin: linkedinIdx >= 0 ? vals[linkedinIdx] : '',
        });
      }

      const result = storeAddContacts(newContacts);
      showToast(`Imported ${result.added} contacts (${result.duplicates} duplicates skipped)`);
      onDataChange?.();
      setShowImport(false);
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleScrape = async () => {
    if (!scrapeUrl) return;
    setScraping(true);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl }),
      });
      const profile = await res.json();
      if (profile.error) { showToast(profile.error, 'error'); return; }
      storeAddContacts([profile]);
      showToast(`Added ${profile.firstName || ''} ${profile.lastName || ''}`);
      setScrapeUrl('');
      setShowScrape(false);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setScraping(false); }
  };

  const handleVerifyAll = () => {
    const updated = contacts.map(c => {
      if (!c.email) return c;
      const v = verifyEmail(c.email);
      return { ...c, verified: v.status, verificationScore: v.score, verificationReasons: v.reasons, verifiedAt: new Date().toISOString() };
    });
    saveContacts(updated);
    const valid = updated.filter(c => c.verified === 'valid').length;
    const risky = updated.filter(c => c.verified === 'risky').length;
    const invalid = updated.filter(c => c.verified === 'invalid').length;
    showToast(`Verified: ${valid} valid, ${risky} risky, ${invalid} invalid`);
  };

  const handleEnrichAll = () => {
    const updated = contacts.map(c => enrichContact(c));
    saveContacts(updated);
    showToast(`Enriched ${updated.length} contacts`);
  };

  const handleScoreAll = () => {
    const sentEmails = getSentEmails();
    const updated = contacts.map(c => scoreContact(c, sentEmails));
    saveContacts(updated);
    showToast(`Scored ${updated.length} contacts`);
  };

  const handleDeleteSelected = () => {
    if (selected.size === 0) return;
    const updated = contacts.filter(c => !selected.has(c.id));
    saveContacts(updated);
    showToast(`Deleted ${selected.size} contacts`);
    setSelected(new Set());
    onDataChange?.();
  };

  const handleClearAll = () => {
    if (!confirm('Clear ALL contacts? This cannot be undone.')) return;
    saveContacts([]);
    showToast('All contacts cleared');
    setSelected(new Set());
    onDataChange?.();
  };

  const handleBulkTag = () => {
    if (!newTag || selected.size === 0) return;
    const updated = contacts.map(c => selected.has(c.id) ? { ...c, tags: [...new Set([...(c.tags || []), newTag])] } : c);
    saveContacts(updated);
    showToast(`Tagged ${selected.size} contacts with "${newTag}"`);
    setNewTag('');
    setShowTagModal(false);
  };

  const handleCheckReplies = async () => {
    setCheckingReplies(true);
    try {
      const sentEmails = getSentEmails();
      const threadIds = [...new Set(sentEmails.filter(e => e.threadId).map(e => e.threadId))];
      if (threadIds.length === 0) { showToast('No sent emails with thread IDs to check', 'error'); return; }
      const res = await fetch('/api/email/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadIds }),
      });
      const data = await res.json();
      if (data.error) { showToast(data.error, 'error'); return; }
      const replies = data.replies || [];
      // Map replies back to contacts via sent emails
      const statuses = { ...replyStatuses };
      const updatedEmails = [...sentEmails];
      let replyCount = 0;
      replies.forEach(reply => {
        const sentEmail = sentEmails.find(e => e.threadId === reply.threadId);
        if (sentEmail) {
          const idx = updatedEmails.findIndex(e => e.id === sentEmail.id);
          if (idx >= 0) updatedEmails[idx] = { ...updatedEmails[idx], replied: true };
          const contactEmail = sentEmail.to?.toLowerCase();
          if (contactEmail) {
            statuses[contactEmail] = { sentiment: reply.sentiment, snippet: reply.snippet, receivedAt: reply.receivedAt };
            replyCount++;
          }
        }
      });
      saveSentEmails(updatedEmails);
      saveReplyStatuses(statuses);
      // Auto-tag contacts based on sentiment
      const updated = contacts.map(c => {
        const status = statuses[c.email?.toLowerCase()];
        if (!status) return c;
        const sentimentTag = `reply:${status.sentiment}`;
        const tags = [...new Set([...(c.tags || []), sentimentTag])];
        return { ...c, tags };
      });
      saveContacts(updated);
      showToast(`Found ${replyCount} replies. Contacts auto-tagged.`);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setCheckingReplies(false); }
  };

  const toggleSelect = (id) => { const next = new Set(selected); next.has(id) ? next.delete(id) : next.add(id); setSelected(next); };
  const toggleAll = () => { selected.size === filtered.length ? setSelected(new Set()) : setSelected(new Set(filtered.map(c => c.id))); };

  const allTags = [...new Set(contacts.flatMap(c => c.tags || []))];
  const filtered = contacts.filter(c => {
    if (search && !`${c.firstName} ${c.lastName} ${c.email} ${c.company}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (tagFilter && !(c.tags || []).includes(tagFilter)) return false;
    if (tierFilter && c.leadTier !== tierFilter) return false;
    if (verifiedFilter && c.verified !== verifiedFilter) return false;
    return true;
  });

  const tierBadge = (tier) => { const map = { hot: 'badge-red', warm: 'badge-orange', cool: 'badge-blue', cold: 'badge-gray' }; return tier ? <span className={`badge ${map[tier] || 'badge-gray'}`}>{tier}</span> : null; };
  const verifiedBadge = (v) => { const map = { valid: 'badge-green', risky: 'badge-yellow', invalid: 'badge-red' }; return v ? <span className={`badge ${map[v] || 'badge-gray'}`}>{v}</span> : null; };
  const replyBadge = (email) => { const s = replyStatuses[email?.toLowerCase()]; if (!s) return null; const map = { interested: 'badge-green', not_interested: 'badge-red', out_of_office: 'badge-yellow', bounced: 'badge-red', neutral: 'badge-gray' }; return <span className={`badge ${map[s.sentiment] || 'badge-gray'}`} title={s.snippet}>{s.sentiment.replace('_', ' ')}</span>; };

  return (
    <div>
      <div className="card-header">
        <div>
          <h2 className="card-title">Contacts ({contacts.length})</h2>
          <p className="card-subtitle">Manage, verify, enrich, and score your contacts</p>
        </div>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={() => setShowImport(true)}>Import CSV</button>
          <button className="btn btn-secondary" onClick={() => setShowScrape(true)}>Scrape LinkedIn</button>
          <button className="btn btn-secondary" onClick={handleVerifyAll} disabled={contacts.length === 0}>Verify All</button>
          <button className="btn btn-secondary" onClick={handleEnrichAll} disabled={contacts.length === 0}>Enrich All</button>
          <button className="btn btn-secondary" onClick={handleScoreAll} disabled={contacts.length === 0}>Score All</button>
          <button className="btn btn-secondary" onClick={handleCheckReplies} disabled={contacts.length === 0 || checkingReplies}>{checkingReplies ? <><span className="spinner" /> Checking...</> : 'Check Replies'}</button>
        </div>
      </div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="input" style={{ maxWidth: '240px' }} placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="select" style={{ maxWidth: '160px' }} value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
            <option value="">All tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="select" style={{ maxWidth: '140px' }} value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
            <option value="">All tiers</option>
            <option value="hot">Hot</option><option value="warm">Warm</option><option value="cool">Cool</option><option value="cold">Cold</option>
          </select>
          <select className="select" style={{ maxWidth: '140px' }} value={verifiedFilter} onChange={e => setVerifiedFilter(e.target.value)}>
            <option value="">All status</option>
            <option value="valid">Valid</option><option value="risky">Risky</option><option value="invalid">Invalid</option>
          </select>
          {selected.size > 0 && (
            <>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowTagModal(true)}>Tag ({selected.size})</button>
              <button className="btn btn-sm btn-danger" onClick={handleDeleteSelected}>Delete ({selected.size})</button>
            </>
          )}
          <button className="btn btn-sm btn-danger" onClick={handleClearAll} style={{ marginLeft: 'auto' }}>Clear All</button>
        </div>
      </div>
      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state"><p>No contacts yet. Import a CSV or scrape LinkedIn to get started.</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
                <th>Name</th><th>Email</th><th>Company</th><th>Title</th><th>Verified</th><th>Reply</th><th>Score</th><th>Tier</th><th>Tags</th>
              </tr></thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} /></td>
                    <td>{c.firstName} {c.lastName}</td>
                    <td style={{ fontSize: '12px' }}>{c.email}</td>
                    <td>{c.company || '-'}</td>
                    <td>{c.title || '-'}</td>
                    <td>{verifiedBadge(c.verified)}</td>
                    <td>{replyBadge(c.email)}</td>
                    <td>
                      <div className="score-bar">
                        <div className="progress-bar" style={{ width: '60px' }}>
                          <div className="progress-fill" style={{ width: `${c.leadScore || 0}%`, background: (c.leadScore||0) >= 80 ? 'var(--red)' : (c.leadScore||0) >= 50 ? 'var(--orange)' : (c.leadScore||0) >= 25 ? 'var(--blue)' : 'var(--text-dim)' }} />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>{c.leadScore || 0}</span>
                      </div>
                    </td>
                    <td>{tierBadge(c.leadTier)}</td>
                    <td>{(c.tags || []).map(t => <span key={t} className="tag" style={{ marginRight: '4px' }}>{t}</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Import Contacts from CSV</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Upload a CSV with columns: email, name/first name, last name, company, title, linkedin</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>Choose CSV File</button>
            <button className="btn btn-secondary" onClick={() => setShowImport(false)} style={{ marginLeft: '8px' }}>Cancel</button>
          </div>
        </div>
      )}
      {showScrape && (
        <div className="modal-overlay" onClick={() => setShowScrape(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Scrape LinkedIn Profile</h3>
            <div className="form-group">
              <label className="form-label">LinkedIn Profile URL</label>
              <input className="input" placeholder="https://linkedin.com/in/username" value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)} />
            </div>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={handleScrape} disabled={scraping}>{scraping ? <><span className="spinner" /> Scraping...</> : 'Scrape'}</button>
              <button className="btn btn-secondary" onClick={() => setShowScrape(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showTagModal && (
        <div className="modal-overlay" onClick={() => setShowTagModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Add Tag to {selected.size} Contacts</h3>
            <div className="form-group">
              <label className="form-label">Tag Name</label>
              <input className="input" placeholder="e.g., VIP, Exhibition 2026" value={newTag} onChange={e => setNewTag(e.target.value)} />
            </div>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={handleBulkTag}>Add Tag</button>
              <button className="btn btn-secondary" onClick={() => setShowTagModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
