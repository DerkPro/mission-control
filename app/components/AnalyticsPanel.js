'use client';
import { useMemo } from 'react';
import { useABTests, useContacts, useSentEmails, useSequences } from '../lib/store';

function buildAnalyticsData(contacts, emails, sequences, abTests) {
  const opensByHour = {};
  emails
    .filter(email => email.opened && email.sentAt)
    .forEach(email => {
      const hour = new Date(email.sentAt).getHours();
      opensByHour[hour] = (opensByHour[hour] || 0) + 1;
    });

  const bestSendTimes = Object.entries(opensByHour)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour, opens]) => ({ hour: parseInt(hour, 10), opens }));

  return {
    contacts: {
      total: contacts.length,
      verified: contacts.filter(contact => contact.verified === 'valid').length,
      enriched: contacts.filter(contact => contact.enriched).length,
      tiers: {
        hot: contacts.filter(contact => contact.leadTier === 'hot').length,
        warm: contacts.filter(contact => contact.leadTier === 'warm').length,
        cool: contacts.filter(contact => contact.leadTier === 'cool').length,
        cold: contacts.filter(contact => contact.leadTier === 'cold').length,
      },
    },
    emails: {
      total: emails.length,
      opened: emails.filter(email => email.opened).length,
      replied: emails.filter(email => email.replied).length,
      openRate: emails.length ? ((emails.filter(email => email.opened).length / emails.length) * 100).toFixed(1) : 0,
      replyRate: emails.length ? ((emails.filter(email => email.replied).length / emails.length) * 100).toFixed(1) : 0,
    },
    sequences: {
      total: sequences.length,
      active: sequences.filter(sequence => sequence.status === 'active').length,
    },
    abTests: {
      total: abTests.length,
    },
    bestSendTimes,
  };
}

export default function AnalyticsPanel() {
  const contacts = useContacts();
  const emails = useSentEmails();
  const sequences = useSequences();
  const abTests = useABTests();
  const data = useMemo(() => buildAnalyticsData(contacts, emails, sequences, abTests), [contacts, emails, sequences, abTests]);

  return (
    <div>
      <div className="card-header"><div><h2 className="card-title">Performance Snapshot</h2><p className="card-subtitle">A cleaner read on list quality, engagement, and sequence momentum</p></div></div>
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Total Contacts</div><div className="stat-value">{data.contacts.total}</div></div>
        <div className="stat-card"><div className="stat-label">Verified</div><div className="stat-value" style={{ color: 'var(--green)' }}>{data.contacts.verified}</div></div>
        <div className="stat-card"><div className="stat-label">Enriched</div><div className="stat-value" style={{ color: 'var(--blue)' }}>{data.contacts.enriched}</div></div>
        <div className="stat-card"><div className="stat-label">Emails Sent</div><div className="stat-value">{data.emails.total}</div></div>
        <div className="stat-card"><div className="stat-label">Open Rate</div><div className="stat-value" style={{ color: 'var(--accent)' }}>{data.emails.openRate}%</div></div>
        <div className="stat-card"><div className="stat-label">Reply Rate</div><div className="stat-value" style={{ color: 'var(--orange)' }}>{data.emails.replyRate}%</div></div>
      </div>
      <div className="grid-3">
        <div className="card"><h3 className="card-title" style={{ marginBottom: '16px' }}>Lead Tiers</h3>
          {data.contacts.total === 0 ? <div className="empty-state"><p>No contacts scored yet</p></div> :
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[{ tier: 'hot', label: 'Hot', color: 'var(--red)', count: data.contacts.tiers.hot }, { tier: 'warm', label: 'Warm', color: 'var(--orange)', count: data.contacts.tiers.warm }, { tier: 'cool', label: 'Cool', color: 'var(--blue)', count: data.contacts.tiers.cool }, { tier: 'cold', label: 'Cold', color: 'var(--text-dim)', count: data.contacts.tiers.cold }].map(t => (
              <div key={t.tier}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}><span style={{ color: t.color, fontWeight: 600 }}>{t.label}</span><span>{t.count}</span></div><div className="progress-bar"><div className="progress-fill" style={{ width: `${data.contacts.total > 0 ? (t.count / data.contacts.total) * 100 : 0}%`, background: t.color }} /></div></div>
            ))}
          </div>}
        </div>
        <div className="card"><h3 className="card-title" style={{ marginBottom: '16px' }}>Sequences</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><div className="stat-label">Total</div><div style={{ fontSize: '24px', fontWeight: 700 }}>{data.sequences.total}</div></div>
            <div><div className="stat-label">Active</div><div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--green)' }}>{data.sequences.active}</div></div>
            <div><div className="stat-label">A/B Tests</div><div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent)' }}>{data.abTests.total}</div></div>
          </div>
        </div>
        <div className="card"><h3 className="card-title" style={{ marginBottom: '16px' }}>Best Send Times</h3>
          {data.bestSendTimes?.length > 0 ? <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.bestSendTimes.map((t, i) => (<div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}><span style={{ fontSize: '13px', fontWeight: 600 }}>{t.hour === 0 ? '12 AM' : t.hour < 12 ? `${t.hour} AM` : t.hour === 12 ? '12 PM' : `${t.hour - 12} PM`}</span><span className="badge badge-green">{t.opens} opens</span></div>))}
          </div> : <div className="empty-state"><p>Send emails to discover optimal times</p><p style={{ fontSize: '12px', marginTop: '8px' }}>Recommended: Tue-Thu, 9-11 AM</p></div>}
        </div>
      </div>
    </div>
  );
}
