'use client';

import React from 'react';

export interface VehicleEmissionCardProps {
  numberPlate: string;
  vehicleType: 'car' | 'ambulance' | 'police' | 'fire' | 'ev' | 'nv';
  isElectric?: boolean;
  emissionRate: number; // g CO2 per km
  currentSpeed: number; // km/h
  distanceTraveled?: number;
  currentEmissionPerHour?: number;
  timeElapsed?: number; // seconds
  imageUrl?: string;
  onClick?: () => void;
}

export const VehicleEmissionCard: React.FC<VehicleEmissionCardProps> = ({
  numberPlate,
  vehicleType,
  isElectric = false,
  emissionRate,
  currentSpeed,
  distanceTraveled,
  currentEmissionPerHour,
  timeElapsed,
  imageUrl,
  onClick,
}) => {
  const getVehicleIcon = () => {
    switch (vehicleType) {
      case 'ambulance':
        return '🚑';
      case 'police':
        return '🚔';
      case 'fire':
        return '🚒';
      case 'ev':
        return '⚡';
      default:
        return '🚗';
    }
  };

  const getVehicleColor = () => {
    switch (vehicleType) {
      case 'ambulance':
        return 'border-neo-badge-success';
      case 'police':
        return 'border-neo-cyan';
      case 'fire':
        return 'border-neo-danger';
      case 'ev':
        return 'border-neo-success';
      default:
        return 'border-neo-purple';
    }
  };

  const getEmissionColor = () => {
    if (isElectric) return '#00ff00';
    if (emissionRate < 150) return '#10b981'; // Green
    if (emissionRate < 250) return '#fbbf24'; // Yellow
    if (emissionRate < 350) return '#f97316'; // Orange
    return '#ef4444'; // Red
  };

  return (
    <div
      onClick={onClick}
      className={`neo-card p-4 space-y-3 cursor-pointer transition-all hover:shadow-neo-card-hover border-l-4 ${getVehicleColor()}`}
    >
      <div className="flex items-start justify-between">
        {/* Left: Vehicle info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl">{getVehicleIcon()}</span>
            <div>
              <p className="text-xs font-semibold text-neo-text-muted uppercase">License Plate</p>
              <p className="text-lg font-mono font-bold text-neo-text-primary break-all">
                {numberPlate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-block px-2 py-1 rounded-neo-sm text-xs font-semibold">
              <span className={`neo-badge ${isElectric ? 'neo-badge-success' : 'neo-badge-cyan'}`}>
                {isElectric ? '⚡ EV' : '🔥 ' + vehicleType.toUpperCase()}
              </span>
            </span>
            {isElectric && <span className="text-xs text-neo-success font-semibold">0g Net Emissions</span>}
          </div>
        </div>

        {/* Right: Emission gauge */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-neo-dark-secondary border-2 border-neo-border">
            <div className="text-center">
              <p className="text-xs text-neo-text-muted">g CO2/km</p>
              <p className="text-xl font-bold" style={{ color: getEmissionColor() }}>
                {Math.round(emissionRate)}
              </p>
            </div>
          </div>
          {isElectric && <span className="text-2xl">🌱</span>}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neo-border">
        <div className="text-center p-2 bg-neo-dark-card rounded-neo-sm">
          <p className="text-xs text-neo-text-muted">Speed</p>
          <p className="text-sm font-bold text-neo-cyan">{currentSpeed} km/h</p>
        </div>

        <div className="text-center p-2 bg-neo-dark-card rounded-neo-sm">
          <p className="text-xs text-neo-text-muted">
            {distanceTraveled !== undefined ? 'Distance' : 'Rate'}
          </p>
          <p className="text-sm font-bold text-neo-magenta">
            {distanceTraveled !== undefined ? `${distanceTraveled.toFixed(1)} km` : `${(emissionRate * currentSpeed).toFixed(0)} g/h`}
          </p>
        </div>

        <div className="text-center p-2 bg-neo-dark-card rounded-neo-sm">
          <p className="text-xs text-neo-text-muted">
            {currentEmissionPerHour !== undefined ? 'Per Hour' : 'Status'}
          </p>
          <p className="text-sm font-bold text-neo-orange">
            {currentEmissionPerHour !== undefined
              ? `${(currentEmissionPerHour / 1000).toFixed(1)}kg`
              : currentSpeed > 0 ? 'Moving' : 'Idle'}
          </p>
        </div>
      </div>

      {/* Additional info */}
      {timeElapsed && (
        <div className="p-2 bg-neo-dark-secondary rounded-neo-sm text-xs">
          <p className="text-neo-text-muted">
            Active for{' '}
            <span className="text-neo-text-primary font-semibold">
              {Math.floor(timeElapsed / 60)} min {timeElapsed % 60} sec
            </span>
          </p>
        </div>
      )}
    </div>
  );
};

export default VehicleEmissionCard;
