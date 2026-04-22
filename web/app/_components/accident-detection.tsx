'use client';

import React, { useState } from 'react';

export interface AccidentReport {
  id: string;
  timestamp: string;
  location: { latitude: number; longitude: number };
  severity: 'minor' | 'moderate' | 'severe';
  vehiclesInvolved: number;
  reportedBy: string;
  description: string;
  status: 'new' | 'acknowledged' | 'resolved';
}

export interface AccidentDetectionComponentProps {
  onReportAccident?: (location: { latitude: number; longitude: number }, severity: string) => void;
  recentAccidents?: AccidentReport[];
  compact?: boolean;
}

export const AccidentDetectionComponent: React.FC<AccidentDetectionComponentProps> = ({
  onReportAccident,
  recentAccidents = [],
  compact = false,
}) => {
  const [isReporting, setIsReporting] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<'minor' | 'moderate' | 'severe'>('moderate');

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'minor':
        return 'text-yellow-400 bg-yellow-400 bg-opacity-10 border-yellow-400';
      case'moderate':
        return 'text-orange-400 bg-orange-400 bg-opacity-10 border-orange-400';
      case 'severe':
        return 'text-red-500 bg-red-500 bg-opacity-10 border-red-500';
      default:
        return 'text-neo-cyan';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'minor':
        return '⚠️';
      case 'moderate':
        return '🚨';
      case 'severe':
        return '🚨🚨';
      default:
        return '⚠️';
    }
  };

  if (compact) {
    return (
      <div className="neo-card neo-card-magenta p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-neo-magenta">🚗 Accident Detection</h3>
          <button
            onClick={() => setIsReporting(true)}
            className="px-3 py-1 bg-neo-danger text-white rounded-neo-sm text-sm font-semibold hover:shadow-neo-glow-magenta transition-all"
          >
            🆘 Report
          </button>
        </div>

        {recentAccidents.length > 0 && (
          <div className="space-y-2">
            {recentAccidents.slice(0, 2).map((accident) => (
              <div
                key={accident.id}
                className={`p-2 rounded-neo-sm text-xs border-l-2 ${getSeverityColor(accident.severity)}`}
              >
                <p className="font-semibold">
                  {getSeverityIcon(accident.severity)} {accident.severity.toUpperCase()}
                </p>
                <p className="text-neo-text-muted text-xs">
                  {new Date(accident.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="neo-card neo-card-magenta space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-neo-magenta">🚗 Accident Detection & Reporting</h3>
        <span className="text-2xl">🚨</span>
      </div>

      {/* Emergency Report Button */}
      <button
        onClick={() => setIsReporting(true)}
        className="w-full bg-gradient-to-r from-neo-danger to-neo-magenta hover:shadow-neo-glow-magenta text-white font-bold py-3 rounded-neo-lg transition-all transform hover:scale-105"
      >
        🆘 REPORT ACCIDENT
      </button>

      {/* Report Form */}
      {isReporting && (
        <div className="space-y-3 p-4 bg-neo-dark-secondary rounded-neo-lg border border-neo-border">
          <h4 className="font-bold text-neo-magenta">Report Details</h4>

          <div className="space-y-2">
            <label className="text-sm text-neo-text-secondary">Severity Level</label>
            <div className="flex gap-2">
              {(['minor', 'moderate', 'severe'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setSelectedSeverity(level)}
                  className={`flex-1 py-2 rounded-neo-md font-semibold text-sm transition-all ${
                    selectedSeverity === level
                      ? `${getSeverityColor(level)} border-2`
                      : 'bg-neo-dark-card border border-neo-border text-neo-text-secondary'
                  }`}
                >
                  {getSeverityIcon(level)} {level.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-neo-text-secondary">Vehicles Involved</label>
            <input
              type="number"
              min="1"
              max="10"
              defaultValue="2"
              className="neo-input"
              placeholder="Number of vehicles"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-neo-text-secondary">Description</label>
            <textarea
              className="neo-input resize-none h-20"
              placeholder="Describe the accident details..."
            />
          </div>

          <div className="flex gap-2 pt-3 border-t border-neo-border">
            <button
              onClick={() => {
                onReportAccident?.({ latitude: 28.7041, longitude: 77.1025 }, selectedSeverity);
                setIsReporting(false);
              }}
              className="flex-1 neo-btn-primary py-2 text-sm"
            >
              ✓ Submit Report
            </button>
            <button
              onClick={() => setIsReporting(false)}
              className="flex-1 neo-btn-secondary py-2 text-sm"
            >
              ✕ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Recent Accidents */}
      {recentAccidents.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-neo-border">
          <h4 className="font-bold text-neo-cyan text-sm">📋 Recent Incidents</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentAccidents.map((accident) => (
              <div
                key={accident.id}
                className={`p-3 rounded-neo-md border-l-4 ${getSeverityColor(
                  accident.severity
                )} bg-neo-dark-secondary`}
              >
                <div className="flex items-start justify-between mb-1">
                  <p className="font-semibold text-sm">
                    {getSeverityIcon(accident.severity)} {accident.severity.toUpperCase()} Accident
                  </p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    accident.status === 'resolved'
                      ? 'bg-neo-success bg-opacity-20 text-neo-success'
                      : accident.status === 'acknowledged'
                      ? 'bg-neo-cyan bg-opacity-20 text-neo-cyan'
                      : 'bg-neo-orange bg-opacity-20 text-neo-orange'
                  }`}>
                    {accident.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-neo-text-muted mb-1">
                  {new Date(accident.timestamp).toLocaleString()}
                </p>
                <p className="text-xs text-neo-text-secondary">
                  📍 {accident.vehiclesInvolved} vehicle(s) • {accident.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentAccidents.length === 0 && !isReporting && (
        <div className="p-4 bg-neo-dark-secondary rounded-neo-lg text-center text-neo-text-muted text-sm">
          ✓ No recent accidents reported in this area
        </div>
      )}
    </div>
  );
};

export default AccidentDetectionComponent;
