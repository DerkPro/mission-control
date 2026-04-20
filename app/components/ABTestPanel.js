'use client';
import { useMemo, useState } from 'react';
import { getABTests, saveABTests, useABTests, useSentEmails } from '../lib/store';

function buildTestSummaries(tests, emails) {
  return tests.map(test => {
    const vA = emails.filter(email => email.variant === `${test.id}-A`);
    const vB = emails.filter(email => email.variant === `${test.id}-B`);

    return {
      ...test,
      stats: {
        A: {
          sent: vA.length,
          opened: vA.filter(email => email.opened).length,
          replied: vA.filter(email => email.replied).length,
        },
        B: {
          sent: vB.length,
          opened: vB.filter(email => email.opened).length,
          replied: vB.filter(email => email.replied).length,
        },
      },
    };
  });
}

export default function ABTestPanel({ showToast }) {
  const storedTests = useABTests();
  const sentEmails = useSentEmails();
  const tests = useMemo(() => buildTestSummaries(storedTests, sentEmails), [storedTests, sentEmails]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', subjectA: '', bodyA: '', subjectB: '', bodyB: '', splitRatio: 50 });

  const handleCreate = () => {
    if (!form.name || !form.subjectA || !form.subjectB) return showToast('Fill in all fields', 'error');
    const t = getABTests();
    t.push({ id: crypto.randomUUID(), name: form.name, variantA: { subject: form.subjectA, body: form.bodyA }, variantB: { subject: form.subjectB, body: form.bodyB }, splitRatio: form.splitRatio, status: 'active', createdAt: new Date().toISOString() });
    saveABTests(t);
    setForm({ name: '', subjectA: '', bodyA: '', subjectB: '', bodyB: '', splitRatio: 50 });
    setShowCreate(false);
    showToast('A/B test created');
  };

  const handleDelete = (id) => {
    saveABTests(getABTests().filter(test => test.id !== id));
    showToast('Test deleted');
  };

  const getWinner = (stats) => {
    if (!stats) return null;
    const aR = stats.A.sent > 0 ? stats.A.opened / stats.A.sent : 0;
    const bR = stats.B.sent > 0 ? stats.B.opened / stats.B.sent : 0;
    if (stats.A.sent < 5 && stats.B.sent < 5) return 'Not enough data';
    return aR > bR ? 'Variant A winning' : bR > aR ? 'Variant B winning' : 'Tied';
  };

  return (
    <div>
      <div className="card-header"><div><h2 className="card-title">A/B Testing</h2><p className="card-subtitle">Test different subject lines and content to optimize performance</p></div><button className="btn btn-primary" onClick={() => setShowCreate(true)}>New A/B Test</button></div>
      {tests.length === 0 ? <div className="card"><div className="empty-state"><p>No A/B tests yet. Create one to start optimizing.</p></div></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {tests.map(test => (
            <div key={test.id} className="card">
              <div className="card-header"><div><span className="card-title">{test.name}</span><div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Split: {test.splitRatio}% A / {100 - test.splitRatio}% B {test.stats && <span style={{ marginLeft: '12px', color: 'var(--accent)' }}>{getWinner(test.stats)}</span>}</div></div><button className="btn btn-sm btn-danger" onClick={() => handleDelete(test.id)}>Delete</button></div>
              <div className="grid-2">
                {['A', 'B'].map(v => (
                  <div key={v} style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: v === 'A' ? 'var(--accent)' : 'var(--orange)' }}>Variant {v}</div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{test[`variant${v}`].subject}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{test[`variant${v}`].body?.slice(0, 100)}...</div>
                    {test.stats && (<div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '12px' }}><span>Sent: <strong>{test.stats[v].sent}</strong></span><span>Opens: <strong>{test.stats[v].opened}</strong></span><span>Replies: <strong>{test.stats[v].replied}</strong></span><span style={{ color: 'var(--green)' }}>Rate: <strong>{test.stats[v].sent > 0 ? ((test.stats[v].opened / test.stats[v].sent) * 100).toFixed(0) : 0}%</strong></span></div>)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {showCreate && (<div className="modal-overlay" onClick={() => setShowCreate(false)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}><h3 className="modal-title">Create A/B Test</h3>
        <div className="form-group"><label className="form-label">Test Name</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g., Subject Line Test" /></div>
        <div className="form-group"><label className="form-label">Split Ratio (% going to A)</label><input className="input" type="number" min="10" max="90" value={form.splitRatio} onChange={e => setForm({ ...form, splitRatio: parseInt(e.target.value) || 50 })} /></div>
        <div className="grid-2">
          <div><h4 style={{ fontSize: '14px', marginBottom: '10px', color: 'var(--accent)' }}>Variant A</h4><div className="form-group"><label className="form-label">Subject</label><input className="input" value={form.subjectA} onChange={e => setForm({ ...form, subjectA: e.target.value })} /></div><div className="form-group"><label className="form-label">Body</label><textarea className="textarea" value={form.bodyA} onChange={e => setForm({ ...form, bodyA: e.target.value })} /></div></div>
          <div><h4 style={{ fontSize: '14px', marginBottom: '10px', color: 'var(--orange)' }}>Variant B</h4><div className="form-group"><label className="form-label">Subject</label><input className="input" value={form.subjectB} onChange={e => setForm({ ...form, subjectB: e.target.value })} /></div><div className="form-group"><label className="form-label">Body</label><textarea className="textarea" value={form.bodyB} onChange={e => setForm({ ...form, bodyB: e.target.value })} /></div></div>
        </div>
        <div className="btn-group"><button className="btn btn-primary" onClick={handleCreate}>Create Test</button><button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button></div>
      </div></div>)}
    </div>
  );
}
