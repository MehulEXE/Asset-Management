import React from 'react';
import { Activity, ShieldCheck, ShieldAlert, Cpu, Database, Server } from 'lucide-react';

interface MetricRecord {
  id: string;
  hostname: string;
  category: string;
  cpu_usage: number;
  ram_usage: number;
  disk_usage: number;
  last_seen: string;
}

interface MonitoringProps {
  metrics: MetricRecord[];
}

export const Monitoring: React.FC<MonitoringProps> = ({ metrics }) => {
  return (
    <div className="animated-fade">
      {/* Visual Header */}
      <div className="card" style={{ marginBottom: '24px', padding: '20px 24px', backgroundColor: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div className="kpi-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Activity />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>Live Infrastructure Monitoring</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Real-time telemetry and health diagnostics received from running Windows Discovery agents.</p>
          </div>
        </div>
      </div>

      {/* Grid of Devices */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {metrics.map(device => {
          const isHealthy = device.cpu_usage < 80 && device.ram_usage < 85;

          return (
            <div key={device.id} className="card" style={{ 
              borderLeft: `5px solid ${isHealthy ? 'var(--success)' : 'var(--danger)'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '15px'
            }}>
              {/* Device Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-header)', fontWeight: 'bold' }}>{device.hostname}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Category: {device.category}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isHealthy ? (
                    <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldCheck size={12} /> Healthy
                    </span>
                  ) : (
                    <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldAlert size={12} /> Bottleneck
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* CPU */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Cpu size={14} /> CPU Utilization
                    </span>
                    <span style={{ fontWeight: 'bold', color: device.cpu_usage > 80 ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {device.cpu_usage}%
                    </span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      backgroundColor: device.cpu_usage > 80 ? 'var(--danger)' : 'var(--primary)', 
                      width: `${device.cpu_usage}%` 
                    }} />
                  </div>
                </div>

                {/* RAM */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Server size={14} /> Memory (RAM) Load
                    </span>
                    <span style={{ fontWeight: 'bold', color: device.ram_usage > 85 ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {device.ram_usage}%
                    </span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      backgroundColor: device.ram_usage > 85 ? 'var(--danger)' : 'var(--primary)', 
                      width: `${device.ram_usage}%` 
                    }} />
                  </div>
                </div>

                {/* Disk */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Database size={14} /> Disk Storage (C:)
                    </span>
                    <span style={{ fontWeight: 'bold', color: device.disk_usage > 90 ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {device.disk_usage}%
                    </span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      backgroundColor: device.disk_usage > 90 ? 'var(--danger)' : 'var(--success)', 
                      width: `${device.disk_usage}%` 
                    }} />
                  </div>
                </div>
              </div>

              {/* Footer check-in info */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Telemetry Status: Active</span>
                <span>Last Scan: {device.last_seen}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
