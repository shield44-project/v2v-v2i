'use client';

import React from 'react';
import { getAQIColor, getAQICategory } from '@/lib/v2x/pollution';

export interface PollutionPredictionWidgetProps {
  aqi: number;
  trend?: 'up' | 'down' | 'stable';
  location?: string;
  forecast?: {
    '1h': number;
    '3h': number;
    '6h': number;
  };
  compact?: boolean;
  onClick?: () => void;
}

export const PollutionPredictionWidget: React.FC<PollutionPredictionWidgetProps> = ({
  aqi,
  trend = 'stable',
  location = 'Current Location',
  forecast,
  compact = false,
  onClick,
}) => {
  const category = getAQICategory(aqi);
  const color = getAQIColor(aqi);

  const getTrendIcon = () => {
    if (trend === 'up') return '📈';
    if (trend === 'down') return '📉';
    return '→';
  };

  if (compact) {
    return (
      <div
        onClick={onClick}
        className="neo-card neo-card-cyan cursor-pointer p-3 hover:shadow-neo-card-hover transition-all"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-neo-text-secondary text-xs uppercase font-semibold">Air Quality</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold" style={{ color }}>
                {Math.round(aqi)}
              </span>
              <span className="text-xs text-neo-text-muted">{category}</span>
            </div>
          </div>
          <div className="text-2xl">{getTrendIcon()}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="neo-card neo-card-cyan p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-neo-cyan">Air Quality Index</h3>
        <span className="text-2xl">{getTrendIcon()}</span>
      </div>

      <div className="space-y-3">
        {/* Main AQI Display */}
        <div className="bg-neo-dark-secondary p-4 rounded-neo-lg border border-neo-border">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <p className="text-neo-text-secondary text-sm uppercase tracking-wider">Current AQI</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-bold" style={{ color }}>
                  {Math.round(aqi)}
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-neo-text-primary">{category}</p>
                  <p className="text-xs text-neo-text-muted">{location}</p>
                </div>
              </div>
            </div>

            {/* Visual indicator */}
            <div className="text-5xl">
              {aqi < 50 && '😊'}
              {aqi >= 50 && aqi < 100 && '🙂'}
              {aqi >= 100 && aqi < 200 && '😐'}
              {aqi >= 200 && aqi < 300 && '😟'}
              {aqi >= 300 && aqi < 400 && '😷'}
              {aqi >= 400 && '💀'}
            </div>
          </div>
        </div>

        {/* AQI Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neo-text-secondary">Good</span>
            <span className="text-xs text-neo-text-secondary">Poor</span>
            <span className="text-xs text-neo-text-secondary">Severe</span>
          </div>
          <div className="h-2 bg-neo-dark-secondary rounded-full overflow-hidden border border-neo-border-light">
            <div
              className="h-full bg-gradient-to-r from-green-500 via-yellow-500 via-red-500 to-purple-900"
              style={{ width: `${Math.min(100, (aqi / 500) * 100)}%` }}
            />
          </div>
        </div>

        {/* Health Advisory */}
        <div className="bg-neo-dark-secondary p-3 rounded-neo-md border-l-4" style={{ borderColor: color }}>
          <p className="text-sm text-neo-text-primary">
            {aqi <= 50 && '✓ Air quality is good. Safe for outdoor activities.'}
            {aqi > 50 && aqi <= 100 && '⚠ Satisfactory. Sensitive groups should be cautious.'}
            {aqi > 100 && aqi <= 200 && '⚠ Moderate pollution. Consider indoor activities.'}
            {aqi > 200 && aqi <= 300 && '🚨 Poor air quality. Avoid outdoor activities.'}
            {aqi > 300 && aqi <= 400 && '🚨 Very poor. Use N95 masks if outside.'}
            {aqi > 400 && '🚨 SEVERE. Stay indoors. Use air purifiers.'}
          </p>
        </div>

        {/* Forecast */}
        {forecast && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-neo-cyan">24-Hour Forecast</h4>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '1h', value: forecast['1h'] },
                { label: '3h', value: forecast['3h'] },
                { label: '6h', value: forecast['6h'] },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-neo-dark-secondary p-2 rounded-neo-md text-center border border-neo-border"
                >
                  <p className="text-xs text-neo-text-secondary">{item.label}</p>
                  <p
                    className="font-bold text-sm mt-1"
                    style={{ color: getAQIColor(item.value) }}
                  >
                    {Math.round(item.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="bg-neo-purple bg-opacity-10 p-3 rounded-neo-md border border-neo-purple border-opacity-30">
          <p className="text-xs font-semibold text-neo-purple uppercase tracking-wider">💡 Recommendations</p>
          <ul className="text-xs text-neo-text-secondary mt-2 space-y-1">
            <li>• Use eco-friendly routes to reduce emissions</li>
            <li>• Keep vehicle windows closed in high pollution</li>
            <li>• Consider electric vehicles for daily commute</li>
          </ul>
        </div>
      </div>

      {onClick && (
        <button
          onClick={onClick}
          className="w-full neo-btn-secondary py-2 text-sm"
        >
          View Detailed Report
        </button>
      )}
    </div>
  );
};

export default PollutionPredictionWidget;
