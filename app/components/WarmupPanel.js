'use client';
import { useState } from 'react';
import { saveWarmup, useWarmup } from '../lib/store';

function generateSchedule(start, target, rate) {
  const schedule = []; let daily = start, day = 1;
  while (daily < target) { schedule.push({ day, volume: Math.round(daily) }); daily *= rate; day++; }
  schedule.push({ day, volume: target });
  return schedule;
}

export default function WarmupPanel({ showToast }) {
  const warmup = useWarmup();
  const [startingVolume, setStartingVolume] = useState(5);
  const [targetVolume, setTargetVolume] = useState(50);
  const [rampUpRate, setRampUpRate] = useState(2);

  const handleStart = () => {
    const config = { active: true, startDate: new Date().toISOString(), currentDay: 1, startingVolume, targetVolume, rampUpRate, schedule: generateSchedule(startingVolume, targetVolume, rampUpRate), history: [] };
    saveWarmup(config);
    showToast('Warmup started');
  };

  const handlePause = () => {
    saveWarmup({ ...warmup, active: false });
    showToast('Warmup paused');
  };
  const handleReset = () => {
    saveWarmup({});
    showToast('Warmup reset');
  };

  const maxVol = warmup.schedule ? Math.max(...warmup.schedule.map(s => s.volume)) : targetVolume;

  return (
    <div>
      <div className="card-header"><div><h2 className="card-title">Email Warmup</h2><p className="card-subtitle">Gradually increase sending volume to build sender reputation</p></div></div>
      <div className="grid-2">
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '16px' }}>Warmup Configuration</h3>
          {!warmup.active ? (<>
            <div className="form-group"><label className="form-label">Starting Daily Volume</label><input className="input" type="number" value={startingVolume} onChange={e => setStartingVolume(parseInt(e.target.value) || 5)} /></div>
            <div className="form-group"><label className="form-label">Target Daily Volume</label><input className="input" type="number" value={targetVolume} onChange={e => setTargetVolume(parseInt(e.target.value) || 50)} /></div>
            <div className="form-group"><label className="form-label">Ramp-up Multiplier</label><input className="input" type="number" step="0.1" value={rampUpRate} onChange={e => setRampUpRate(parseFloat(e.target.value) || 1.5)} /></div>
            <button className="btn btn-primary" onClick={handleStart}>Start Warmup</button>
          </>) : (<>
            <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="stat-card"><div className="stat-label">Status</div><div className="stat-value" style={{ fontSize: '18px', color: 'var(--green)' }}>Active</div></div>
              <div className="stat-card"><div className="stat-label">Current Day</div><div className="stat-value" style={{ fontSize: '18px' }}>Day {warmup.currentDay || 1}</div></div>
              <div className="stat-card"><div className="stat-label">Today&apos;s Limit</div><div className="stat-value" style={{ fontSize: '18px' }}>{warmup.schedule?.[Math.min((warmup.currentDay || 1) - 1, warmup.schedule.length - 1)]?.volume || warmup.startingVolume} emails</div></div>
              <div className="stat-card"><div className="stat-label">Target</div><div className="stat-value" style={{ fontSize: '18px' }}>{warmup.targetVolume}/day</div></div>
            </div>
            <div className="btn-group"><button className="btn btn-secondary" onClick={handlePause}>Pause</button><button className="btn btn-danger" onClick={handleReset}>Reset</button></div>
          </>)}
        </div>
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '16px' }}>Warmup Schedule</h3>
          {warmup.schedule ? (<>
            <div className="warmup-bar">{warmup.schedule.map((s, i) => (<div key={i} className={`warmup-bar-item ${i < (warmup.currentDay || 1) - 1 ? 'completed' : i === (warmup.currentDay || 1) - 1 ? 'active' : ''}`} style={{ height: `${(s.volume / maxVol) * 100}%` }} title={`Day ${s.day}: ${s.volume} emails`} />))}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}><span>Day 1</span><span>Day {warmup.schedule.length}</span></div>
            <div style={{ marginTop: '16px' }}><table><thead><tr><th>Day</th><th>Volume</th><th>Status</th></tr></thead><tbody>{warmup.schedule.map((s, i) => (<tr key={i}><td>Day {s.day}</td><td>{s.volume} emails</td><td>{i < (warmup.currentDay || 1) - 1 ? <span className="badge badge-green">Done</span> : i === (warmup.currentDay || 1) - 1 ? <span className="badge badge-blue">Current</span> : <span className="badge badge-gray">Upcoming</span>}</td></tr>))}</tbody></table></div>
          </>) : <div className="empty-state"><p>Start warmup to see the schedule</p></div>}
        </div>
      </div>
    </div>
  );
}
