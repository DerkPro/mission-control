'use client';

import { Fragment, useMemo, useState, useSyncExternalStore } from 'react';

const EMPTY_LIST = [];
const subscribers = new Set();
const storageCache = new Map();

function cloneValue(value) {
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === 'object') return { ...value };
  return value;
}

function getStorageItem(key) {
  return localStorage.getItem(`mc_${key}`);
}

function readStoredValue(key, fallback = []) {
  try {
    const raw = getStorageItem(key);
    return raw ? JSON.parse(raw) : cloneValue(fallback);
  } catch {
    return cloneValue(fallback);
  }
}

function subscribe(callback) {
  subscribers.add(callback);
  const onStorage = (event) => {
    if (!event.key || event.key.startsWith('mc_')) {
      callback();
    }
  };

  window.addEventListener('storage', onStorage);

  return () => {
    subscribers.delete(callback);
    window.removeEventListener('storage', onStorage);
  };
}

function useStoredValue(key, fallback = []) {
  return useSyncExternalStore(
    subscribe,
    () => {
      const storageKey = `mc_${key}`;
      const raw = getStorageItem(key);
      const cached = storageCache.get(storageKey);

      if (cached && cached.raw === raw) {
        return cached.value;
      }

      try {
        const value = raw ? JSON.parse(raw) : fallback;
        storageCache.set(storageKey, { raw, value });
        return value;
      } catch {
        storageCache.set(storageKey, { raw, value: fallback });
        return fallback;
      }
    },
    () => fallback,
  );
}

function writeStoredValue(key, value) {
  const storageKey = `mc_${key}`;
  const raw = JSON.stringify(value);
  localStorage.setItem(storageKey, raw);
  storageCache.set(storageKey, { raw, value });
  subscribers.forEach((callback) => callback());
}

function useContacts() {
  return useStoredValue('contacts', EMPTY_LIST);
}

function useSentEmails() {
  return useStoredValue('sent_emails', EMPTY_LIST);
}

function getSentEmails() {
  return readStoredValue('sent_emails', []);
}

function setSentEmails(value) {
  writeStoredValue('sent_emails', value);
}

const EMAIL_TEMPLATES = {
  introduction: {
    subject: 'Quick intro - connecting with {{company}}',
    body: 'Hi {{firstName}},\n\nI came across {{company}}\'s work and was impressed by what you\'re doing.\n\nI\'d love to connect and explore potential synergies. Would you be open to a brief 15-minute call this week?\n\nLooking forward to hearing from you.\n\nBest regards',
  },
  followUp: {
    subject: 'Following up - {{company}}',
    body: 'Hi {{firstName}},\n\nI wanted to follow up on my previous message. I understand things get busy, so I wanted to keep this brief.\n\nI believe there\'s a great opportunity for {{company}} and I\'d love to discuss it further.\n\nWould a quick 10-minute chat work for you this week?\n\nBest regards',
  },
  coldOutreach: {
    subject: '{{company}} + [Your Company] - potential partnership',
    body: 'Hi {{firstName}},\n\nAs {{title}} at {{company}}, you\'re likely focused on growth and efficiency.\n\nWe\'ve helped similar companies achieve significant results, and I\'d love to share some ideas specific to {{company}}.\n\nWould it make sense to connect for a quick call?\n\nBest regards',
  },
  exhibition: {
    subject: 'Meet us at the exhibition - exclusive preview',
    body: 'Hi {{firstName}},\n\nWe\'re excited about the upcoming exhibition and wanted to personally invite {{company}} to visit our booth.\n\nWe have some exciting things to showcase that are directly relevant to your work.\n\nWould you like to schedule a dedicated time slot for a private demo?\n\nLooking forward to meeting you there.\n\nBest regards',
  },
  thankYou: {
    subject: 'Great connecting with you, {{firstName}}',
    body: 'Hi {{firstName}},\n\nThank you for taking the time to connect. It was great learning more about {{company}}\'s work.\n\nAs discussed, I\'ll be sending over some additional information shortly. In the meantime, feel free to reach out if you have any questions.\n\nLooking forward to our next conversation.\n\nBest regards',
  },
};

function applyPlaceholders(template, contact) {
  return template
    .replace(/\{\{name\}\}/gi, `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'there')
    .replace(/\{\{firstName\}\}/gi, contact.firstName || 'there')
    .replace(/\{\{lastName\}\}/gi, contact.lastName || '')
    .replace(/\{\{company\}\}/gi, contact.company || 'your company')
    .replace(/\{\{title\}\}/gi, contact.title || '');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function neutralizeDraft(text, contacts) {
  if (!text) return '';

  const replacements = [];
  for (const contact of contacts) {
    const firstName = (contact.firstName || '').trim();
    const lastName = (contact.lastName || '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const company = (contact.company || '').trim();
    const title = (contact.title || '').trim();

    if (fullName) replacements.push([fullName, '{{name}}']);
    if (firstName) replacements.push([firstName, '{{firstName}}']);
    if (lastName) replacements.push([lastName, '{{lastName}}']);
    if (company) replacements.push([company, '{{company}}']);
    if (title) replacements.push([title, '{{title}}']);
  }

  const uniqueReplacements = [...new Map(
    replacements
      .sort((left, right) => right[0].length - left[0].length)
      .map(([from, to]) => [from.toLowerCase(), [from, to]]),
  ).values()];

  return uniqueReplacements.reduce((result, [from, to]) => {
    return result.replace(new RegExp(escapeRegExp(from), 'gi'), to);
  }, text);
}

async function requestGeneratedDraft({ contact, emailType, tone, currentSubject, currentBody, template }) {
  const response = await fetch('/api/email/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contact,
      emailType,
      tone,
      currentSubject,
      currentBody,
      template,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error || 'Email generation failed');
  }

  return {
    subject: payload?.subject || '',
    body: payload?.body || '',
  };
}

async function sendEmail({ to, subject, textBody }) {
  const response = await fetch('/api/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to,
      subject,
      textBody,
    }),
  });

  if (!response.ok) {
    throw new Error('Email send failed');
  }
}

function saveSentEmail(entry) {
  const sentEmails = getSentEmails();
  sentEmails.push({
    ...entry,
    id: crypto.randomUUID(),
    sentAt: new Date().toISOString(),
  });
  setSentEmails(sentEmails);
}

function PoweredByBadge() {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        background: 'var(--bg-soft)',
        color: 'var(--text)',
        fontSize: '13px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <svg width="16" height="16" viewBox="0 6.603 1192.672 1193.397" fill="#d97757" aria-label="Claude" style={{ flexShrink: 0 }}>
        <path d="m233.96 800.215 234.684-131.678 3.947-11.436-3.947-6.363h-11.436l-39.221-2.416-134.094-3.624-116.296-4.832-112.67-6.04-28.35-6.04-26.577-35.035 2.738-17.477 23.84-16.027 34.147 2.98 75.463 5.155 113.235 7.812 82.147 4.832 121.692 12.644h19.329l2.738-7.812-6.604-4.832-5.154-4.832-117.182-79.41-126.845-83.92-66.443-48.321-35.92-24.484-18.12-22.953-7.813-50.093 32.618-35.92 43.812 2.98 11.195 2.98 44.375 34.147 94.792 73.37 123.786 91.167 18.12 15.06 7.249-5.154.886-3.624-8.135-13.61-67.329-121.692-71.838-123.785-31.974-51.302-8.456-30.765c-2.98-12.645-5.154-23.275-5.154-36.242l37.127-50.416 20.537-6.604 49.53 6.604 20.86 18.121 30.765 70.39 49.852 110.818 77.315 150.684 22.631 44.698 12.08 41.396 4.51 12.645h7.813v-7.248l6.362-84.886 11.759-104.215 11.436-134.094 3.946-37.772 18.685-45.262 37.127-24.482 28.994 13.852 23.839 34.148-3.303 22.067-14.174 92.134-27.785 144.323-18.121 96.644h10.55l12.08-12.08 48.887-64.913 82.147-102.685 36.242-40.752 42.282-45.02 27.14-21.423h51.303l37.772 56.135-16.913 57.986-52.832 67.007-43.812 56.779-62.82 84.563-39.22 67.651 3.623 5.396 9.343-.886 141.906-30.201 76.671-13.852 91.49-15.705 41.396 19.329 4.51 19.65-16.269 40.189-97.852 24.16-114.764 22.954-170.9 40.43-2.093 1.53 2.416 2.98 76.993 7.248 32.94 1.771h80.617l150.12 11.195 39.222 25.933 23.517 31.732-3.946 24.16-60.403 30.766-81.503-19.33-190.228-45.26-65.235-16.27h-9.02v5.397l54.362 53.154 99.624 89.96 124.752 115.973 6.362 28.671-16.027 22.63-16.912-2.415-109.611-82.47-42.282-37.127-95.758-80.618h-6.363v8.456l22.067 32.296 116.537 175.167 6.04 53.719-8.456 17.476-30.201 10.55-33.181-6.04-68.215-95.758-70.39-107.84-56.778-96.644-6.926 3.947-33.503 360.886-15.705 18.443-36.243 13.852-30.201-22.953-16.027-37.127 16.027-73.37 19.329-95.758 15.704-76.107 14.175-94.55 8.456-31.41-.563-2.094-6.927.886-71.275 97.852-108.402 146.497-85.772 91.812-20.537 8.134-35.597-18.443 3.301-32.94 19.893-29.315 118.712-151.007 71.597-93.583 46.228-54.04-.322-7.813h-2.738l-315.302 204.725-56.135 7.248-24.16-22.63 2.98-37.128 11.435-12.08 94.792-65.236-.322.323z" />
      </svg>
      <span>Claude Haiku 4.5</span>
    </div>
  );
}

export default function EmailPanel({ showToast, onDataChange }) {
  const contacts = useContacts();
  const sentEmails = useSentEmails();

  const [activeTab, setActiveTab] = useState('compose');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [emailType, setEmailType] = useState('introduction');
  const [tone, setTone] = useState('professional');
  const [bestTime, setBestTime] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [personalizeEachRecipient, setPersonalizeEachRecipient] = useState(true);

  const selectedContacts = useMemo(
    () => contacts.filter((contact) => selectedIds.has(contact.id)),
    [contacts, selectedIds],
  );

  const previewContact = selectedContacts[0] || null;
  const selectedCount = selectedContacts.length;
  const selectedTemplate = EMAIL_TEMPLATES[emailType] || EMAIL_TEMPLATES.introduction;
  const allSelected = contacts.length > 0 && selectedCount === contacts.length;

  function toggleRecipient(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  }

  async function handleGenerate() {
    if (!previewContact) {
      showToast('Select at least one recipient to generate a personalized draft', 'error');
      return;
    }

    setGenerating(true);
    try {
      const generated = await requestGeneratedDraft({
        contact: previewContact,
        emailType,
        tone,
        currentSubject: subject,
        currentBody: body,
        template: selectedTemplate,
      });

      setSubject(generated.subject);
      setBody(generated.body);

      if (selectedCount > 1) {
        showToast(`Preview generated for ${previewContact.company || previewContact.email}. Each selected recipient will get a personalized version when sent.`);
      } else {
        showToast('Personalized email generated');
      }
    } catch (error) {
      showToast(error.message || 'Email generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!selectedCount) {
      showToast('Select at least one contact', 'error');
      return;
    }

    if (!subject || !body) {
      showToast('Subject and body are required', 'error');
      return;
    }

    setSending(true);
    setProgress({ current: 0, total: selectedCount });

    const shouldRepersonalize = selectedCount > 1 && personalizeEachRecipient;
    const neutralSubject = shouldRepersonalize ? neutralizeDraft(subject, selectedContacts) : subject;
    const neutralBody = shouldRepersonalize ? neutralizeDraft(body, selectedContacts) : body;

    let sentCount = 0;
    let failedCount = 0;

    for (const contact of selectedContacts) {
      try {
        let finalSubject = applyPlaceholders(neutralSubject, contact);
        let finalBody = applyPlaceholders(neutralBody, contact);

        if (shouldRepersonalize) {
          const generated = await requestGeneratedDraft({
            contact,
            emailType,
            tone,
            currentSubject: finalSubject,
            currentBody: finalBody,
            template: selectedTemplate,
          });

          finalSubject = generated.subject || finalSubject;
          finalBody = generated.body || finalBody;
        }

        await sendEmail({
          to: contact.email,
          subject: finalSubject,
          textBody: finalBody,
        });

        saveSentEmail({
          to: contact.email,
          subject: finalSubject,
          body: finalBody,
          opened: false,
          replied: false,
        });

        sentCount += 1;
      } catch {
        failedCount += 1;
      }

      setProgress({ current: sentCount + failedCount, total: selectedCount });
    }

    showToast(`Sent ${sentCount} emails${failedCount > 0 ? `, ${failedCount} failed` : ''}`);
    setSending(false);
    onDataChange?.();
  }

  function optimizeSendTime() {
    const hourlyOpens = {};

    getSentEmails()
      .filter((email) => email.opened && email.sentAt)
      .forEach((email) => {
        const hour = new Date(email.sentAt).getHours();
        hourlyOpens[hour] = (hourlyOpens[hour] || 0) + 1;
      });

    const ranked = Object.entries(hourlyOpens).sort((left, right) => right[1] - left[1]);

    if (ranked.length > 0) {
      const bestHour = parseInt(ranked[0][0], 10);
      const label = bestHour === 0 ? '12 AM' : bestHour < 12 ? `${bestHour} AM` : bestHour === 12 ? '12 PM' : `${bestHour - 12} PM`;
      setBestTime(`${label} (${ranked[0][1]} opens)`);
    } else {
      setBestTime('Tue-Thu, 9-11 AM (industry best practice)');
    }

    showToast('Send time optimized');
  }

  const followUpRows = [...new Map(sentEmails.map((email) => [email.to, email])).values()];

  return (
    <div>
      {/* Section header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 className="card-title" style={{ marginBottom: '4px' }}>Email Studio</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Compose and send AI-personalized emails to your contacts
        </p>
      </div>

      {/* Underline tab bar */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        {[
          { key: 'compose', label: 'Compose' },
          { key: 'followup', label: `Follow-up (${sentEmails.length})` },
          { key: 'sent', label: 'Sent History' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: '8px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-1px',
              color: activeTab === key ? 'var(--text)' : 'var(--text-muted)',
              fontWeight: activeTab === key ? 600 : 400,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'compose' && (
        <div className="grid-2">
          {/* Recipients column */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                Recipients {selectedCount > 0 && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>({selectedCount})</span>}
              </span>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  if (allSelected) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(contacts.map((contact) => contact.id)));
                  }
                }}
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {contacts.length === 0 ? (
                <div className="empty-state">
                  <p>No contacts. Import some first.</p>
                </div>
              ) : (
                contacts.map((contact) => (
                  <label
                    key={contact.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 0',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <input type="checkbox" checked={selectedIds.has(contact.id)} onChange={() => toggleRecipient(contact.id)} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {contact.firstName} {contact.lastName}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.email}</div>
                    </div>
                    {contact.verified && (
                      <span className={`badge ${contact.verified === 'valid' ? 'badge-green' : contact.verified === 'risky' ? 'badge-yellow' : 'badge-red'}`}>
                        {contact.verified}
                      </span>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Compose column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* AI controls */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>AI Email Writer</span>
                  {previewContact ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Preview: {previewContact.company || previewContact.email}
                      {selectedCount > 1 ? ` · ${selectedCount} recipients` : ''}
                    </p>
                  ) : (
                    <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>Select a contact to generate a draft</p>
                  )}
                </div>
                <PoweredByBadge />
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <select className="select" value={emailType} onChange={(event) => setEmailType(event.target.value)} style={{ flex: 1, minWidth: '120px' }}>
                  <option value="introduction">Introduction</option>
                  <option value="followUp">Follow-up</option>
                  <option value="coldOutreach">Cold Outreach</option>
                  <option value="exhibition">Exhibition Invite</option>
                  <option value="thankYou">Thank You</option>
                </select>
                <select className="select" value={tone} onChange={(event) => setTone(event.target.value)} style={{ flex: 1, minWidth: '100px' }}>
                  <option value="professional">Professional</option>
                  <option value="formal">Formal</option>
                  <option value="casual">Casual</option>
                </select>
                <button className="btn btn-sm btn-primary" onClick={handleGenerate} disabled={generating || selectedCount === 0}>
                  {generating ? (
                    <Fragment><span className="spinner" /> Generating...</Fragment>
                  ) : (
                    'Generate'
                  )}
                </button>
              </div>

              {selectedCount > 1 && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={personalizeEachRecipient}
                    onChange={(event) => setPersonalizeEachRecipient(event.target.checked)}
                  />
                  Re-personalize for each recipient on send
                </label>
              )}
            </div>

            {/* Email form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ marginBottom: '6px' }}>Subject</label>
                <input
                  className="input"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Subject line... (use {{firstName}}, {{company}})"
                />
              </div>

              <div>
                <label className="form-label" style={{ marginBottom: '6px' }}>Body</label>
                <textarea
                  className="textarea"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Email body..."
                  style={{ minHeight: '200px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '4px' }}>
                <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
                  {sending ? (
                    <Fragment><span className="spinner" /> Sending {progress.current}/{progress.total}...</Fragment>
                  ) : (
                    `Send to ${selectedCount} contact${selectedCount !== 1 ? 's' : ''}`
                  )}
                </button>
                <button className="btn btn-sm btn-secondary" onClick={optimizeSendTime}>
                  Optimize Send Time
                </button>
                {bestTime && <span style={{ fontSize: '12px', color: 'var(--green)' }}>{bestTime}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'followup' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Follow-up List</span>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => {
                setSentEmails([]);
                showToast('Sent emails cleared');
              }}
            >
              Clear All
            </button>
          </div>

          {sentEmails.length === 0 ? (
            <div className="empty-state">
              <p>No emails sent yet.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>To</th>
                    <th>Subject</th>
                    <th>Sent</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {followUpRows.map((email) => (
                    <tr key={email.id}>
                      <td>{email.to}</td>
                      <td>{email.subject}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(email.sentAt).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            setActiveTab('compose');
                            setSelectedIds(new Set(contacts.filter((contact) => contact.email === email.to).map((contact) => contact.id)));
                            setSubject(`Re: ${email.subject}`);
                            setBody('');
                            setEmailType('followUp');
                          }}
                        >
                          Follow Up
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'sent' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>All Sent Emails</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>({sentEmails.length})</span>
          </div>

          {sentEmails.length === 0 ? (
            <div className="empty-state">
              <p>No emails sent yet.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>To</th>
                    <th>Subject</th>
                    <th>Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {sentEmails.slice().reverse().map((email) => (
                    <tr key={email.id}>
                      <td>{email.to}</td>
                      <td>{email.subject}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(email.sentAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
