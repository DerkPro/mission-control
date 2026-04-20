'use client';
import { useState } from 'react';
import { addSentEmail, getSentEmails, saveSentEmails, useContacts, useSentEmails } from '../lib/store';

const EMAIL_TEMPLATES = {
  introduction: { subject: 'Quick intro — connecting with {{company}}', body: 'Hi {{firstName}},\n\nI came across {{company}}\'s work and was impressed by what you\'re doing.\n\nI\'d love to connect and explore potential synergies. Would you be open to a brief 15-minute call this week?\n\nLooking forward to hearing from you.\n\nBest regards' },
  followUp: { subject: 'Following up — {{company}}', body: 'Hi {{firstName}},\n\nI wanted to follow up on my previous message. I understand things get busy, so I wanted to keep this brief.\n\nI believe there\'s a great opportunity for {{company}} and I\'d love to discuss it further.\n\nWould a quick 10-minute chat work for you this week?\n\nBest regards' },
  coldOutreach: { subject: '{{company}} + [Your Company] — potential partnership', body: 'Hi {{firstName}},\n\nAs {{title}} at {{company}}, you\'re likely focused on growth and efficiency.\n\nWe\'ve helped similar companies achieve significant results, and I\'d love to share some ideas specific to {{company}}.\n\nWould it make sense to connect for a quick call?\n\nBest regards' },
  exhibition: { subject: 'Meet us at the exhibition — exclusive preview', body: 'Hi {{firstName}},\n\nWe\'re excited about the upcoming exhibition and wanted to personally invite {{company}} to visit our booth.\n\nWe have some exciting things to showcase that are directly relevant to your work.\n\nWould you like to schedule a dedicated time slot for a private demo?\n\nLooking forward to meeting you there.\n\nBest regards' },
  thankYou: { subject: 'Great connecting with you, {{firstName}}', body: 'Hi {{firstName}},\n\nThank you for taking the time to connect. It was great learning more about {{company}}\'s work.\n\nAs discussed, I\'ll be sending over some additional information shortly. In the meantime, feel free to reach out if you have any questions.\n\nLooking forward to our next conversation.\n\nBest regards' },
};

function personalize(text, contact) {
  return text
    .replace(/\{\{name\}\}/gi, `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'there')
    .replace(/\{\{firstName\}\}/gi, contact.firstName || 'there')
    .replace(/\{\{lastName\}\}/gi, contact.lastName || '')
    .replace(/\{\{company\}\}/gi, contact.company || 'your company')
    .replace(/\{\{title\}\}/gi, contact.title || '');
}

export default function EmailPanel({ showToast, onDataChange }) {
  const contacts = useContacts();
  const sentEmails = useSentEmails();
  const [tab, setTab] = useState('compose');
  const [selected, setSelected] = useState(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  const [aiPurpose, setAiPurpose] = useState('introduction');
  const [aiTone, setAiTone] = useState('professional');
  const [optimalTime, setOptimalTime] = useState(null);

  const toggleContact = (id) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n); };
  const selectAll = () => { selected.size === contacts.length ? setSelected(new Set()) : setSelected(new Set(contacts.map(c => c.id))); };

  const handleSend = async () => {
    if (selected.size === 0) return showToast('Select at least one contact', 'error');
    if (!subject || !body) return showToast('Subject and body are required', 'error');
    setSending(true);
    const targets = contacts.filter(c => selected.has(c.id));
    setSendProgress({ current: 0, total: targets.length });
    let sent = 0, failed = 0;
    for (const contact of targets) {
      try {
        const pSubject = personalize(subject, contact);
        const pBody = personalize(body, contact);
        const res = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: contact.email, subject: pSubject, textBody: pBody }),
        });
        if (res.ok) {
          sent++;
          addSentEmail({ to: contact.email, subject: pSubject, body: pBody, opened: false, replied: false });
        } else failed++;
      } catch { failed++; }
      setSendProgress({ current: sent + failed, total: targets.length });
    }
    showToast(`Sent ${sent} emails${failed > 0 ? `, ${failed} failed` : ''}`);
    setSending(false);
    onDataChange?.();
  };

  const handleAIWrite = () => {
    const firstContact = contacts.find(c => selected.has(c.id)) || {};
    const template = EMAIL_TEMPLATES[aiPurpose] || EMAIL_TEMPLATES.introduction;
    let finalBody = template.body;
    let finalSubject = template.subject;
    if (aiTone === 'formal') { finalBody = finalBody.replace(/Hi /g, 'Dear ').replace(/quick /g, '').replace(/chat/g, 'meeting'); }
    else if (aiTone === 'casual') { finalBody = finalBody.replace(/Hi /g, 'Hey ').replace(/Best regards/g, 'Cheers'); }
    setSubject(personalize(finalSubject, firstContact));
    setBody(personalize(finalBody, firstContact));
    showToast('AI email generated');
  };

  const handleOptimizeSendTime = () => {
    const emails = getSentEmails();
    const opensByHour = {};
    emails.filter(e => e.opened && e.sentAt).forEach(e => {
      const h = new Date(e.sentAt).getHours();
      opensByHour[h] = (opensByHour[h] || 0) + 1;
    });
    const sorted = Object.entries(opensByHour).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const h = parseInt(sorted[0][0]);
      setOptimalTime(`${h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`} (${sorted[0][1]} opens)`);
    } else {
      setOptimalTime('Tue-Thu, 9-11 AM (industry best practice)');
    }
    showToast('Send time optimized');
  };

  const handleClearSent = () => {
    saveSentEmails([]);
    showToast('Sent emails cleared');
  };

  return (
    <div>
      <div className="card-header">
        <div><h2 className="card-title">Email Studio</h2><p className="card-subtitle">Compose, personalize, and launch sends with AI support and cleaner timing controls</p></div>
      </div>
      <div className="tabs">
        <button className={`tab ${tab === 'compose' ? 'active' : ''}`} onClick={() => setTab('compose')}>Compose</button>
        <button className={`tab ${tab === 'followup' ? 'active' : ''}`} onClick={() => setTab('followup')}>Follow-up ({sentEmails.length})</button>
        <button className={`tab ${tab === 'sent' ? 'active' : ''}`} onClick={() => setTab('sent')}>Sent History</button>
      </div>

      {tab === 'compose' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Select Recipients ({selected.size})</span>
              <button className="btn btn-sm btn-secondary" onClick={selectAll}>{selected.size === contacts.length ? 'Deselect All' : 'Select All'}</button>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {contacts.length === 0 ? <div className="empty-state"><p>No contacts. Import some first.</p></div> :
              contacts.map(c => (
                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleContact(c.id)} />
                  <div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: 500 }}>{c.firstName} {c.lastName}</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.email}</div></div>
                  {c.verified && <span className={`badge ${c.verified === 'valid' ? 'badge-green' : c.verified === 'risky' ? 'badge-yellow' : 'badge-red'}`}>{c.verified}</span>}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="card" style={{ marginBottom: '16px' }}>
              <div className="card-header">
                <span className="card-title">AI Email Writer</span>
                <button className="btn btn-sm btn-primary" onClick={handleAIWrite}>Generate Email</button>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select className="select" value={aiPurpose} onChange={e => setAiPurpose(e.target.value)}>
                  <option value="introduction">Introduction</option><option value="followUp">Follow-up</option><option value="coldOutreach">Cold Outreach</option><option value="exhibition">Exhibition Invite</option><option value="thankYou">Thank You</option>
                </select>
                <select className="select" value={aiTone} onChange={e => setAiTone(e.target.value)}>
                  <option value="professional">Professional</option><option value="formal">Formal</option><option value="casual">Casual</option>
                </select>
              </div>
            </div>
            <div className="card" style={{ marginBottom: '16px' }}>
              <div className="form-group"><label className="form-label">Subject</label><input className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject... (use {{firstName}}, {{company}})" /></div>
              <div className="form-group"><label className="form-label">Body</label><textarea className="textarea" value={body} onChange={e => setBody(e.target.value)} placeholder="Email body..." style={{ minHeight: '200px' }} /></div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
                  {sending ? <><span className="spinner" /> Sending {sendProgress.current}/{sendProgress.total}...</> : `Send to ${selected.size} contact${selected.size !== 1 ? 's' : ''}`}
                </button>
                <button className="btn btn-sm btn-secondary" onClick={handleOptimizeSendTime}>Optimize Send Time</button>
                {optimalTime && <span style={{ fontSize: '12px', color: 'var(--green)' }}>Best time: {optimalTime}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'followup' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Follow-up List</span><button className="btn btn-sm btn-danger" onClick={handleClearSent}>Clear All</button></div>
          {sentEmails.length === 0 ? <div className="empty-state"><p>No emails sent yet.</p></div> : (
            <div className="table-wrap"><table><thead><tr><th>To</th><th>Subject</th><th>Sent</th><th>Action</th></tr></thead><tbody>
              {[...new Map(sentEmails.map(e => [e.to, e])).values()].map(e => (
                <tr key={e.id}><td>{e.to}</td><td>{e.subject}</td><td style={{ fontSize: '12px' }}>{new Date(e.sentAt).toLocaleDateString()}</td>
                <td><button className="btn btn-sm btn-secondary" onClick={() => { setTab('compose'); setSelected(new Set(contacts.filter(c => c.email === e.to).map(c => c.id))); setSubject(`Re: ${e.subject}`); setBody(''); setAiPurpose('followUp'); }}>Follow Up</button></td></tr>
              ))}
            </tbody></table></div>
          )}
        </div>
      )}

      {tab === 'sent' && (
        <div className="card">
          <div className="card-header"><span className="card-title">All Sent Emails ({sentEmails.length})</span></div>
          {sentEmails.length === 0 ? <div className="empty-state"><p>No emails sent yet.</p></div> : (
            <div className="table-wrap"><table><thead><tr><th>To</th><th>Subject</th><th>Sent At</th></tr></thead><tbody>
              {sentEmails.slice().reverse().map(e => (
                <tr key={e.id}><td>{e.to}</td><td>{e.subject}</td><td style={{ fontSize: '12px' }}>{new Date(e.sentAt).toLocaleString()}</td></tr>
              ))}
            </tbody></table></div>
          )}
        </div>
      )}
    </div>
  );
}
