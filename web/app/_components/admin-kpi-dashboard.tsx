'use client';

import React from 'react';

export interface KPIData {
  label: string;
  value: string | number;
  unit?: string;
  change?: { value: number; direction: 'up' | 'down' | 'stable' };
  color?: 'cyan' | 'purple' | 'magenta' | 'lime' | 'orange';
  icon?: string;
}

export interface AdminKPIDashboardProps {
  kpis: KPIData[];
  title?: string;
}

const colorMap: Record<string, string> = {
  cyan: 'text-neo-cyan border-neo-cyan',
  purple: 'text-neo-purple border-neo-purple',
  magenta: 'text-neo-magenta border-neo-magenta',
  lime: 'text-neo-lime border-neo-lime',
  orange: 'text-neo-orange border-neo-orange',
};

export const AdminKPIDashboard: React.FC<AdminKPIDashboardProps> = ({
  kpis,
  title = 'System KPIs',
}) => {
  const getTrendIcon = (change?: { value: number; direction: 'up' | 'down' | 'stable' }) => {
    if (!change) return null;
    switch (change.direction) {
      case 'up':
        return '📈';
      case 'down':
        return '📉';
      default:
        return '→';
    }
  };

  const getTrendColor = (change?: { value: number; direction: 'up' | 'down' | 'stable' }, type?: string) => {
    if (!change) return '';
    if (type === 'emissions' || type === 'accidents') {
      // For negative metrics, down is good
      return change.direction === 'down' ? 'text-neo-lime' : 'text-neo-orange';
    }
    // For positive metrics, up is good
    return change.direction === 'up' ? 'text-neo-lime' : 'text-neo-orange';
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-neo-gradient">{title}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <div
            key={idx}
            className={`neo-card p-4 border-l-4 ${colorMap[kpi.color || 'cyan']}`}
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase font-semibold text-neo-text-muted tracking-wider">
                    {kpi.label}
                  </p>
                </div>
                {kpi.icon && <span className="text-2xl">{kpi.icon}</span>}
              </div>

              {/* Value */}
              <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-bold ${colorMap[kpi.color || 'cyan'].split(' ')[0]}`}>
                  {kpi.value}
                </span>
                {kpi.unit && <span className="text-sm text-neo-text-secondary">{kpi.unit}</span>}
              </div>

              {/* Change indicator */}
              {kpi.change && (
                <div className="flex items-center gap-1">
                  <span className="text-sm">{getTrendIcon(kpi.change)}</span>
                  <span className={`text-sm font-semibold ${getTrendColor(kpi.change, kpi.label)}`}>
                    {kpi.change.direction === 'up' ? '+' : ''}
                    {kpi.change.value}
                    {kpi.color === 'cyan' || kpi.color === 'lime' ? '%' : ''}
                  </span>
                  <span className="text-xs text-neo-text-muted">vs last hour</span>
                </div>
              )}

              {/* Progress bar for percentage-based KPIs */}
              {typeof kpi.value === 'string' && kpi.value.includes('%') && (
                <div className="h-2 bg-neo-dark-tertiary rounded-full overflow-hidden border border-neo-border">
                  <div
                    className={`h-full bg-gradient-to-r from-neo-cyan to-neo-purple`}
                    style={{
                      width: `${Math.min(100, parseInt(kpi.value) || 0)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminKPIDashboard;
