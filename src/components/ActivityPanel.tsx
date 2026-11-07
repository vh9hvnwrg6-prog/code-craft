import React, { useState } from 'react';
import { ChevronUp, Terminal, CheckCircle2, AlertTriangle, Activity, Loader2 } from 'lucide-react';

interface ToolEvent {
  id: string;
  tool: string;
  status: 'running' | 'done' | 'error';
  detail: string;
}

const SAMPLE_EVENTS: ToolEvent[] = [
  { id: '1', tool: 'Read', status: 'done', detail: 'src/main.tsx' },
  { id: '2', tool: 'Bash', status: 'running', detail: 'npm run build' },
  { id: '3', tool: 'Glob', status: 'done', detail: 'src/**/*.tsx' }
];

export function ActivityPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [events] = useState<ToolEvent[]>(SAMPLE_EVENTS);
  return (
    <div className={`activity-panel ${open ? 'open' : 'collapsed'}`}>
      <div className="activity-header" onClick={onToggle}>
        <div className="activity-title">
          <Activity size={14} />
          <span>ACTIVITY</span>
          <span className="activity-count">{events.length}</span>
        </div>
        <ChevronUp size={14} className={`chev ${open ? 'open' : ''}`} />
      </div>
      {open && (
        <div className="activity-scroll">
          {events.map((e) => (
            <div key={e.id} className="activity-row">
              <span className="activity-icon">
                {e.status === 'running' ? <Loader2 size={13} className="spin" /> :
                 e.status === 'done' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              </span>
              <span className="activity-tool">{e.tool}</span>
              <span className="activity-detail">{e.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}