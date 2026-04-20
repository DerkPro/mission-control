'use client';
import { useMemo } from 'react';
import { getContacts, saveContacts, getSentEmails, useContacts, useSentEmails } from '../lib/store';

function analyzeHealth(contacts, sentEmails) {
  const total = contacts.length;
  if (total === 0) return null;

  // Missing fields
  const missingEmail = contacts.filter(c => !c.email).length;
  const missingName = contacts.filter(c => !c.firstName && !c.lastName).length;
  const missingCompany = contacts.filter(c => !c.company).length;
  const missingTitle = contacts.filter(c => !c.title).length;

  // Duplicates (same email)
  const emailCounts = {};
  contacts.forEach(c => { if (c.email) { const e = c.email.toLowerCase(); emailCounts[e] = (emailCounts[e] || 0) + 1; } });
  const duplicateEmails = Object.entries(emailCounts).filter(([, count]) => count > 1);
  const duplicateCount = duplicateEmails.reduce((sum, [, count]) => sum + count - 1, 0);

  // Name+Company duplicates
  const nameCompanyCounts = {};
  contacts.forEach(c => {
    if (c.firstName && c.company) {
      const key = `${c.firstName} ${c.lastName}|${c.company}`.toLowerCase();
      nameCompanyCounts[key] = (nameCompanyCounts[key] || 0) + 1;
    }
  });
  const nameCompanyDups = Object.entries(nameCompanyCounts).filter(([, count]) => count > 1).length;

  // Stale contacts (>30 days, no engagement)
  const thirtyDaysAgo = Date.now() - 30 * 86400000;
  const emailsByContact = {};
  sentEmails.forEach(e => { if (e.to) emailsByContact[e.to.toLowerCase()] = true; });
  const staleContacts = contacts.filter(c => {
    if (!c.addedAt) return false;
    const addedTime = new Date(c.addedAt).getTime();
    if (addedTime > thirtyDaysAgo) return false;
    return !emailsByContact[c.email?.toLowerCase()];
  }).length;

  // Invalid emails
  const invalidEmails = contacts.filter(c => c.verified === 'invalid').length;
  const riskyEmails = contacts.filter(c => c.verified === 'risky').length;

  // Not verified
  const unverified = contacts.filter(c => !c.verified).length;

  // Not enriched
  const unenriched = contacts.filter(c => !c.enriched).length;

  // Not scored
  const unscored = contacts.filter(c => !c.leadScore).length;

  // Health score
  const issues = missingEmail + missingName * 0.5 + missingCompany * 0.3 + duplicateCount + invalidEmails * 2 + staleContacts * 0.3;
  const maxIssues = total * 4;
  const healthScore = Math.max(0, Math.round((1 - issues / maxIssues) * 100));

  return {
    total, healthScore,
    missingEmail, missingName, missingCompany, missingTitle,
    duplicateEmails, duplicateCount, nameCompanyDups,
    staleContacts, invalidEmails, riskyEmails,
    unverified, unenriched, unscored,
  };
}

export default function DataHealthPanel({ showToast, onDataChange }) {
  const contacts = useContacts();
  const sentEmails = useSentEmails();
  const data = useMemo(() => analyzeHealth(contacts, sentEmails), [contacts, sentEmails]);

  const handleMergeDuplicates = () => {
    const contacts = getContacts();
    const seen = {};
    const merged = [];
    contacts.forEach(c => {
      const key = c.email?.toLowerCase();
      if (!key) { merged.push(c); return; }
      if (seen[key]) {
        // Merge: keep more complete record
        const existing = merged.find(m => m.email?.toLowerCase() === key);
        if (existing) {
          if (!existing.firstName && c.firstName) existing.firstName = c.firstName;
          if (!existing.lastName && c.lastName) existing.lastName = c.lastName;
          if (!existing.company && c.company) existing.company = c.company;
          if (!existing.title && c.title) existing.title = c.title;
          if (!existing.linkedin && c.linkedin) existing.linkedin = c.linkedin;
          existing.tags = [...new Set([...(existing.tags || []), ...(c.tags || [])])];
        }
      } else {
        seen[key] = true;
        merged.push({ ...c });
      }
    });
    saveContacts(merged);
    showToast(`Merged duplicates: ${contacts.length - merged.length} removed`);
    onDataChange?.();
  };

  const handleRemoveInvalid = () => {
    const contacts = getContacts();
    const valid = contacts.filter(c => c.verified !== 'invalid');
    const removed = contacts.length - valid.length;
    saveContacts(valid);
    showToast(`Removed ${removed} invalid contacts`);
    onDataChange?.();
  };

  const handleRemoveStale = () => {
    const contacts = getContacts();
    const sentEmails = getSentEmails();
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const emailsByContact = {};
    sentEmails.forEach(e => { if (e.to) emailsByContact[e.to.toLowerCase()] = true; });
    const fresh = contacts.filter(c => {
      if (!c.addedAt) return true;
      if (new Date(c.addedAt).getTime() > thirtyDaysAgo) return true;
      return emailsByContact[c.email?.toLowerCase()];
    });
    const removed = contacts.length - fresh.length;
    saveContacts(fresh);
    showToast(`Removed ${removed} stale contacts`);
    onDataChange?.();
  };

  if (!data) return (
    <div>
      <div className="card-header"><div><h2 className="card-title">Data Health</h2><p className="card-subtitle">Monitor and fix data quality issues</p></div></div>
      <div className="card"><div className="empty-state"><p>No contacts yet. Add contacts to see health analysis.</p></div></div>
    </div>
  );

  const healthColor = data.healthScore >= 80 ? 'var(--green)' : data.healthScore >= 50 ? 'var(--orange)' : 'var(--red)';

  return (
    <div>
      <div className="card-header">
        <div><h2 className="card-title">Data Health</h2><p className="card-subtitle">Monitor and fix data quality issues across {data.total} contacts</p></div>
      </div>

      {/* Health Score */}
      <div className="card" style={{ marginBottom: '16px', textAlign: 'center', padding: '24px' }}>
        <div style={{ fontSize: '48px', fontWeight: 800, color: healthColor }}>{data.healthScore}%</div>
        <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>Overall Data Health Score</div>
        <div className="progress-bar" style={{ maxWidth: '400px', margin: '12px auto 0', height: '8px' }}>
          <div className="progress-fill" style={{ width: `${data.healthScore}%`, background: healthColor }} />
        </div>
      </div>

      {/* Issues Grid */}
      <div className="stats-grid" style={{ marginBottom: '16px' }}>
        <div className="stat-card">
          <div className="stat-label">Duplicates</div>
          <div className="stat-value" style={{ color: data.duplicateCount > 0 ? 'var(--red)' : 'var(--green)' }}>{data.duplicateCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Invalid Emails</div>
          <div className="stat-value" style={{ color: data.invalidEmails > 0 ? 'var(--red)' : 'var(--green)' }}>{data.invalidEmails}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Stale (30d+)</div>
          <div className="stat-value" style={{ color: data.staleContacts > 0 ? 'var(--orange)' : 'var(--green)' }}>{data.staleContacts}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Risky Emails</div>
          <div className="stat-value" style={{ color: data.riskyEmails > 0 ? 'var(--orange)' : 'var(--green)' }}>{data.riskyEmails}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Not Verified</div>
          <div className="stat-value">{data.unverified}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Not Enriched</div>
          <div className="stat-value">{data.unenriched}</div>
        </div>
      </div>

      {/* Detailed Issues */}
      <div className="grid-2">
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '16px' }}>Missing Fields</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: 'Missing Email', count: data.missingEmail, color: 'var(--red)' },
              { label: 'Missing Name', count: data.missingName, color: 'var(--orange)' },
              { label: 'Missing Company', count: data.missingCompany, color: 'var(--orange)' },
              { label: 'Missing Title', count: data.missingTitle, color: 'var(--text-dim)' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span>{item.label}</span>
                  <span style={{ fontWeight: 600, color: item.count > 0 ? item.color : 'var(--green)' }}>{item.count}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${data.total > 0 ? (item.count / data.total) * 100 : 0}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '16px' }}>Quick Fixes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Merge Duplicates</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{data.duplicateCount} duplicate emails found</div>
              </div>
              <button className="btn btn-sm btn-primary" onClick={handleMergeDuplicates} disabled={data.duplicateCount === 0}>Fix</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Remove Invalid Emails</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{data.invalidEmails} contacts with invalid emails</div>
              </div>
              <button className="btn btn-sm btn-danger" onClick={handleRemoveInvalid} disabled={data.invalidEmails === 0}>Remove</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Remove Stale Contacts</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{data.staleContacts} contacts with no engagement in 30+ days</div>
              </div>
              <button className="btn btn-sm btn-danger" onClick={handleRemoveStale} disabled={data.staleContacts === 0}>Remove</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Unscored Contacts</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{data.unscored} contacts need scoring</div>
              </div>
              <span className="badge badge-gray">Use Contacts → Score All</span>
            </div>
          </div>
        </div>
      </div>

      {/* Duplicate Details */}
      {data.duplicateEmails.length > 0 && (
        <div className="card" style={{ marginTop: '16px' }}>
          <h3 className="card-title" style={{ marginBottom: '12px' }}>Duplicate Emails ({data.duplicateEmails.length})</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Email</th><th>Count</th></tr></thead>
              <tbody>
                {data.duplicateEmails.slice(0, 20).map(([email, count]) => (
                  <tr key={email}><td style={{ fontSize: '12px', fontFamily: 'monospace' }}>{email}</td><td><span className="badge badge-red">{count}x</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
