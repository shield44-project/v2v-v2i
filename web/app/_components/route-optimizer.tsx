'use client';

import React, { useState } from 'react';
import { Route } from '@/lib/v2x/route-optimization';

export interface RouteOptimizerComponentProps {
  routes?: Route[];
  selectedRoute?: Route;
  onSelectRoute?: (route: Route) => void;
}

export const RouteOptimizerComponent: React.FC<RouteOptimizerComponentProps> = ({
  routes = [],
  selectedRoute,
  onSelectRoute,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (routes.length === 0) {
    return (
      <div className="neo-card neo-card-magenta p-4">
        <p className="text-neo-text-secondary text-sm">No routes available. Enter destination to generate routes.</p>
      </div>
    );
  }

  return (
    <div className="neo-card neo-card-magenta space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-neo-magenta">🗺️ Route Options</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-neo-magenta hover:text-neo-cyan transition-colors"
        >
          {expanded ? '−' : '+'}
        </button>
      </div>

      {/* Quick summary */}
      <div className="grid grid-cols-2 gap-2">
        {routes.slice(0, 2).map((route, idx) => (
          <div
            key={idx}
            onClick={() => onSelectRoute?.(route)}
            className={`p-3 rounded-neo-md cursor-pointer transition-all ${
              selectedRoute?.id === route.id
                ? 'bg-neo-magenta bg-opacity-20 border border-neo-magenta'
                : 'bg-neo-dark-secondary border border-neo-border hover:border-neo-magenta'
            }`}
          >
            <p className="text-xs uppercase font-semibold text-neo-text-secondary">
              {route.objective}
            </p>
            <p className="text-lg font-bold text-neo-magenta mt-1">
              {Math.ceil(route.estimatedTime / 60)} min
            </p>
            <p className="text-xs text-neo-text-muted">
              {route.totalDistance.toFixed(1)} km
            </p>
          </div>
        ))}
      </div>

      {/* Expanded view */}
      {expanded && (
        <div className="space-y-3 pt-3 border-t border-neo-border">
          {routes.map((route, idx) => (
            <div
              key={idx}
              onClick={() => onSelectRoute?.(route)}
              className={`p-3 rounded-neo-md cursor-pointer transition-all border-l-4 ${
                selectedRoute?.id === route.id
                  ? 'bg-neo-dark-secondary border-neo-magenta'
                  : 'bg-neo-dark-tertiary border-neo-border hover:border-neo-magenta'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-neo-text-primary capitalize">
                    {route.objective} Route
                  </p>
                  <p className="text-xs text-neo-text-muted">{route.trafficStatus} traffic</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-neo-magenta">
                    {Math.ceil(route.estimatedTime / 60)}m
                  </p>
                  <p className="text-xs text-neo-text-muted">{route.totalDistance.toFixed(1)}km</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-neo-dark-card p-2 rounded border border-neo-border">
                  <p className="text-neo-text-muted">Emissions</p>
                  <p className="font-bold text-neo-magenta">
                    {(route.totalEmissions / 1000).toFixed(1)}kg
                  </p>
                </div>
                <div className="bg-neo-dark-card p-2 rounded border border-neo-border">
                  <p className="text-neo-text-muted">Quality</p>
                  <p className="font-bold text-neo-magenta">{route.score.toFixed(0)}/100</p>
                </div>
                <div className="bg-neo-dark-card p-2 rounded border border-neo-border">
                  <p className="text-neo-text-muted">Risk</p>
                  <p className="font-bold text-neo-magenta">
                    {route.trafficStatus === 'severe' ? 'High' : 'Low'}
                  </p>
                </div>
              </div>

              {route.emissionsSaved && (
                <div className="mt-2 p-2 bg-neo-success bg-opacity-10 rounded text-xs text-neo-text-primary border border-neo-border">
                  💚 Saves {route.emissionsSaved.toFixed(0)}g CO2 vs standard route
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RouteOptimizerComponent;
