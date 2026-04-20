'use client';
import { useState } from 'react';
import { getSequences, getTriggers, saveSequences, saveTriggers, useContacts, useSequences, useTriggers } from '../lib/store';

export default function SequencesPanel({ showToast }) {
  const sequences = useSequences();
  const contacts = useContacts();
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(null);
  const [showAddContacts, setShowAddContacts] = useState(null);
  const [name, setName] = useState('');
  const [contactSelection, setContactSelection] = useState(new Set());
  const triggers = useTriggers();
  const [showTrigger, setShowTrigger] = useState(false);
  const [triggerField, setTriggerField] = useState('tag');
  const [triggerValue, setTriggerValue] = useState('');
  const [triggerSeqId, setTriggerSeqId] = useState('');

  const handleCreate = () => {
    if (!name) return;
    const seqs = getSequences();
    seqs.push({ id: crypto.randomUUID(), name, steps: [{ type: 'email', delayDays: 0, subject: '', body: '' }, { type: 'email', delayDays: 3, subject: '', body: '' }, { type: 'email', delayDays: 7, subject: '', body: '' }], contacts: [], status: 'draft', createdAt: new Date().toISOString() });
    saveSequences(seqs);
    setName('');
    setShowCreate(false);
    showToast('Sequence created');
  };

  const handleDelete = (id) => {
    saveSequences(getSequences().filter(sequence => sequence.id !== id));
    showToast('Sequence deleted');
  };

  const handleToggleStatus = (seq) => {
    const action = seq.status === 'active' ? 'paused' : 'active';
    saveSequences(getSequences().map(s => s.id === seq.id ? { ...s, status: action } : s));
    showToast(`Sequence ${action}`);
  };

  const handleUpdateSteps = (seq, steps) => {
    saveSequences(getSequences().map(s => s.id === seq.id ? { ...s, steps } : s));
    showToast('Steps updated');
    setShowEdit(null);
  };

  const handleAddContacts = (seqId) => {
    const selectedContacts = contacts.filter(c => contactSelection.has(c.id));
    saveSequences(getSequences().map(s => {
      if (s.id !== seqId) return s;
      const existing = new Set(s.contacts.map(c => c.email));
      const newC = selectedContacts.filter(c => !existing.has(c.email)).map(c => ({ ...c, currentStep: 0, status: 'active', enrolledAt: new Date().toISOString() }));
      return { ...s, contacts: [...s.contacts, ...newC] };
    }));
    showToast(`Added ${selectedContacts.length} contacts`);
    setContactSelection(new Set());
    setShowAddContacts(null);
  };

  const handleAddTrigger = () => {
    if (!triggerValue || !triggerSeqId) return;
    const t = getTriggers();
    t.push({ id: crypto.randomUUID(), field: triggerField, value: triggerValue, sequenceId: triggerSeqId, createdAt: new Date().toISOString() });
    saveTriggers(t);
    setTriggerValue(''); setTriggerSeqId(''); setShowTrigger(false);
    showToast('Trigger created');
  };

  const handleDeleteTrigger = (id) => {
    saveTriggers(getTriggers().filter(t => t.id !== id));
    showToast('Trigger deleted');
  };

  return (
    <div>
      <div className="card-header"><div><h2 className="card-title">Multichannel Sequences</h2><p className="card-subtitle">Create multi-step automated campaigns with email, LinkedIn, and calls</p></div><button className="btn btn-primary" onClick={() => setShowCreate(true)}>New Sequence</button></div>
      {sequences.length === 0 ? <div className="card"><div className="empty-state"><p>No sequences yet. Create one to start automated outreach.</p></div></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sequences.map(seq => (
            <div key={seq.id} className="card">
              <div className="card-header">
                <div><span className="card-title">{seq.name}</span><div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}><span className={`badge ${seq.status === 'active' ? 'badge-green' : seq.status === 'paused' ? 'badge-yellow' : 'badge-gray'}`}>{seq.status}</span><span className="badge badge-blue">{seq.steps?.length || 0} steps</span><span className="badge badge-gray">{seq.contacts?.length || 0} contacts</span></div></div>
                <div className="btn-group"><button className="btn btn-sm btn-secondary" onClick={() => handleToggleStatus(seq)}>{seq.status === 'active' ? 'Pause' : 'Activate'}</button><button className="btn btn-sm btn-secondary" onClick={() => setShowEdit(seq)}>Edit Steps</button><button className="btn btn-sm btn-secondary" onClick={() => setShowAddContacts(seq.id)}>Add Contacts</button><button className="btn btn-sm btn-danger" onClick={() => handleDelete(seq.id)}>Delete</button></div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{(seq.steps || []).map((step, i) => { const color = { email: 'var(--accent)', linkedin: '#0077b5', call: 'var(--green)', task: 'var(--orange)' }[step.type] || 'var(--text-muted)'; const label = { email: 'Email', linkedin: 'LinkedIn', call: 'Call', task: 'Task' }[step.type] || step.type; return (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div className="step-number" style={{ background: color, color: '#fff' }}>{i + 1}</div><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label} {step.delayDays > 0 ? `(+${step.delayDays}d)` : '(imm)'}</span>{i < (seq.steps?.length || 0) - 1 && <span style={{ color: 'var(--text-dim)' }}>→</span>}</div>); })}</div>
            </div>
          ))}
        </div>
      )}
      {/* Workflow Triggers */}
      <div style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div><h3 className="card-title">Workflow Triggers</h3><p className="card-subtitle">Auto-enroll contacts in sequences based on rules</p></div>
          <button className="btn btn-sm btn-primary" onClick={() => setShowTrigger(true)} disabled={sequences.length === 0}>New Trigger</button>
        </div>
        {triggers.length === 0 ? (
          <div className="card"><div className="empty-state"><p>No triggers yet. Create one to auto-enroll contacts when they match conditions.</p></div></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {triggers.map(t => {
              const seq = sequences.find(s => s.id === t.sequenceId);
              return (
                <div key={t.id} className="card" style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                      <span>When</span>
                      <span className="badge badge-blue">{t.field}</span>
                      <span>=</span>
                      <span className="badge badge-green">{t.value}</span>
                      <span>enroll in</span>
                      <span style={{ fontWeight: 600 }}>{seq?.name || 'Unknown'}</span>
                    </div>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteTrigger(t.id)}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Trigger Modal */}
      {showTrigger && (
        <div className="modal-overlay" onClick={() => setShowTrigger(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Create Workflow Trigger</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>When a contact matches this condition, they&apos;ll be auto-enrolled in the selected sequence.</p>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">When field</label>
                <select className="select" value={triggerField} onChange={e => setTriggerField(e.target.value)}>
                  <option value="tag">Tag equals</option>
                  <option value="leadTier">Lead tier equals</option>
                  <option value="source">Source equals</option>
                  <option value="verified">Verified status equals</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Value</label>
                {triggerField === 'leadTier' ? (
                  <select className="select" value={triggerValue} onChange={e => setTriggerValue(e.target.value)}>
                    <option value="">Select...</option>
                    <option value="hot">Hot</option><option value="warm">Warm</option><option value="cool">Cool</option><option value="cold">Cold</option>
                  </select>
                ) : triggerField === 'verified' ? (
                  <select className="select" value={triggerValue} onChange={e => setTriggerValue(e.target.value)}>
                    <option value="">Select...</option>
                    <option value="valid">Valid</option><option value="risky">Risky</option><option value="invalid">Invalid</option>
                  </select>
                ) : (
                  <input className="input" value={triggerValue} onChange={e => setTriggerValue(e.target.value)} placeholder={triggerField === 'tag' ? 'e.g., hot-lead' : 'e.g., apollo'} />
                )}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Enroll in sequence</label>
              <select className="select" value={triggerSeqId} onChange={e => setTriggerSeqId(e.target.value)}>
                <option value="">Select sequence...</option>
                {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={handleAddTrigger}>Create Trigger</button>
              <button className="btn btn-secondary" onClick={() => setShowTrigger(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (<div className="modal-overlay" onClick={() => setShowCreate(false)}><div className="modal" onClick={e => e.stopPropagation()}><h3 className="modal-title">Create New Sequence</h3><div className="form-group"><label className="form-label">Sequence Name</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Exhibition Follow-up" /></div><div className="btn-group"><button className="btn btn-primary" onClick={handleCreate}>Create</button><button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button></div></div></div>)}
      {showEdit && <StepEditor seq={showEdit} onSave={(steps) => handleUpdateSteps(showEdit, steps)} onClose={() => setShowEdit(null)} />}
      {showAddContacts && (<div className="modal-overlay" onClick={() => setShowAddContacts(null)}><div className="modal" onClick={e => e.stopPropagation()}><h3 className="modal-title">Add Contacts to Sequence</h3><div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>{contacts.map(c => (<label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', cursor: 'pointer' }}><input type="checkbox" checked={contactSelection.has(c.id)} onChange={() => { const n = new Set(contactSelection); n.has(c.id) ? n.delete(c.id) : n.add(c.id); setContactSelection(n); }} /><span style={{ fontSize: '13px' }}>{c.firstName} {c.lastName} ({c.email})</span></label>))}</div><div className="btn-group"><button className="btn btn-primary" onClick={() => handleAddContacts(showAddContacts)}>Add {contactSelection.size} Contacts</button><button className="btn btn-secondary" onClick={() => setShowAddContacts(null)}>Cancel</button></div></div></div>)}
    </div>
  );
}

const STEP_TYPES = [
  { value: 'email', label: 'Email', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { value: 'linkedin', label: 'LinkedIn', icon: 'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 6a2 2 0 100-4 2 2 0 000 4z' },
  { value: 'call', label: 'Phone Call', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
  { value: 'task', label: 'Manual Task', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
];

function StepEditor({ seq, onSave, onClose }) {
  const [steps, setSteps] = useState(seq.steps || []);
  const updateStep = (i, field, value) => { const n = [...steps]; n[i] = { ...n[i], [field]: value }; setSteps(n); };
  const addStep = (type = 'email') => setSteps([...steps, { type, delayDays: steps.length * 3, subject: '', body: '', message: '', script: '' }]);
  const removeStep = (i) => setSteps(steps.filter((_, idx) => idx !== i));

  const stepTypeColor = (type) => ({ email: 'var(--accent)', linkedin: '#0077b5', call: 'var(--green)', task: 'var(--orange)' }[type] || 'var(--text-muted)');

  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}><h3 className="modal-title">Edit Sequence Steps</h3>
      {steps.map((step, i) => (<div key={i} className="sequence-step"><div className="step-number" style={{ background: stepTypeColor(step.type), color: '#fff' }}>{i + 1}</div><div className="step-content"><div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}><select className="select" style={{ maxWidth: '140px' }} value={step.type} onChange={e => updateStep(i, 'type', e.target.value)}>{STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select><div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Wait</span><input className="input" type="number" style={{ width: '60px' }} value={step.delayDays} onChange={e => updateStep(i, 'delayDays', parseInt(e.target.value) || 0)} /><span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>days</span></div><button className="btn btn-sm btn-danger" onClick={() => removeStep(i)} style={{ marginLeft: 'auto' }}>Remove</button></div>
        {step.type === 'email' && (<><input className="input" style={{ marginBottom: '6px' }} placeholder="Subject line" value={step.subject || ''} onChange={e => updateStep(i, 'subject', e.target.value)} /><textarea className="textarea" style={{ minHeight: '60px' }} placeholder="Email body (supports {{firstName}}, {{company}})" value={step.body || ''} onChange={e => updateStep(i, 'body', e.target.value)} /></>)}
        {step.type === 'linkedin' && (<><input className="input" style={{ marginBottom: '6px' }} placeholder="Connection request message (max 300 chars)" value={step.message || ''} onChange={e => updateStep(i, 'message', e.target.value)} maxLength={300} /><p style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Task: Send LinkedIn connection request with this message. Contact&apos;s LinkedIn URL will be shown.</p></>)}
        {step.type === 'call' && (<><input className="input" style={{ marginBottom: '6px' }} placeholder="Call objective (e.g., Introduce product, Schedule demo)" value={step.subject || ''} onChange={e => updateStep(i, 'subject', e.target.value)} /><textarea className="textarea" style={{ minHeight: '60px' }} placeholder="Call script / talking points" value={step.script || ''} onChange={e => updateStep(i, 'script', e.target.value)} /></>)}
        {step.type === 'task' && (<input className="input" placeholder="Task description" value={step.subject || ''} onChange={e => updateStep(i, 'subject', e.target.value)} />)}
      </div></div>))}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {STEP_TYPES.map(t => (<button key={t.value} className="btn btn-sm btn-secondary" onClick={() => addStep(t.value)} style={{ borderColor: stepTypeColor(t.value) }}>+ {t.label}</button>))}
      </div>
      <div className="btn-group"><button className="btn btn-primary" onClick={() => onSave(steps)}>Save Steps</button><button className="btn btn-secondary" onClick={onClose}>Cancel</button></div>
    </div></div>
  );
}
