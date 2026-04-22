/**
 * Notification System
 * Handles alerts, broadcasts, and messages for all V2X stakeholders
 */

export type NotificationType = 
  | 'accident' 
  | 'ev-arrival' 
  | 'signal-override' 
  | 'route-alert' 
  | 'emission-warning' 
  | 'pollution-alert' 
  | 'emergency' 
  | 'info';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export type NotificationTarget = 'all' | 'ev' | 'nv' | 'signal' | 'rto' | 'admin' | 'location-based';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: string;
  source: string; // vehicle ID, signal ID, system
  target: NotificationTarget;
  targetRadius?: number; // km for location-based
  location?: {
    latitude: number;
    longitude: number;
  };
  voice?: {
    enabled: boolean;
    text: string;
    language?: string;
  };
  action?: {
    label: string;
    url?: string;
    callback?: string;
  };
  read: boolean;
  readAt?: string;
  expiry?: string; // ISO timestamp when notification expires
  metadata?: Record<string, string | number | boolean>;
}

export interface NotificationQueue {
  notifications: Notification[];
  totalCount: number;
  unreadCount: number;
  lastUpdated: string;
}

/**
 * In-memory notification store (In production, use database + WebSocket)
 */
const NOTIFICATION_STORE: Map<string, Notification> = new Map();
const NOTIFICATION_QUEUE: Notification[] = [];

/**
 * Create a new notification
 */
export function createNotification(
  type: NotificationType,
  title: string,
  message: string,
  priority: NotificationPriority = 'medium',
  options?: Partial<Notification>
): Notification {
  const notification: Notification = {
    id: `notif-${Date.now()}-${Math.random()}`,
    type,
    title,
    message,
    priority,
    timestamp: new Date().toISOString(),
    source: options?.source || 'system',
    target: options?.target || 'all',
    read: false,
    ...options,
  };

  NOTIFICATION_STORE.set(notification.id, notification);
  NOTIFICATION_QUEUE.push(notification);

  return notification;
}

/**
 * Create EV arrival notification
 */
export function createEVArrivalNotification(
  evType: 'ambulance' | 'police' | 'fire',
  location: { latitude: number; longitude: number },
  route: string,
  eta: number // seconds
): Notification {
  const typeLabels = {
    ambulance: 'Ambulance',
    police: 'Police Vehicle',
    fire: 'Fire Truck',
  };

  const voiceMessage = `${typeLabels[evType]} arriving in ${Math.ceil(eta / 60)} minutes. Route: ${route}. Please clear the area.`;

  return createNotification(
    'ev-arrival',
    `${typeLabels[evType]} Approaching`,
    `${typeLabels[evType]} ETA: ${Math.ceil(eta / 60)} minutes via ${route}`,
    'high',
    {
      location,
      target: 'location-based',
      targetRadius: 2, // 2km radius
      voice: {
        enabled: true,
        text: voiceMessage,
      },
      metadata: {
        evType,
        eta,
        route,
      },
    }
  );
}

/**
 * Create accident notification
 */
export function createAccidentNotification(
  location: { latitude: number; longitude: number },
  severity: 'minor' | 'moderate' | 'severe',
  vehicles: string[]
): Notification {
  const severityMap = {
    minor: { priority: 'medium' as NotificationPriority, icon: '⚠️' },
    moderate: { priority: 'high' as NotificationPriority, icon: '🚨' },
    severe: { priority: 'critical' as NotificationPriority, icon: '🚨🚨' },
  };

  const voiceMessage = `Accident detected at coordinates ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}. Severity: ${severity}. Emergency services notified.`;

  return createNotification(
    'accident',
    `${severityMap[severity].icon} Accident Detected`,
    `${severity.charAt(0).toUpperCase() + severity.slice(1)} accident detected. ${vehicles.length} vehicle(s) involved.`,
    severityMap[severity].priority,
    {
      location,
      target: 'location-based',
      targetRadius: 5,
      voice: {
        enabled: true,
        text: voiceMessage,
      },
      metadata: {
        severity,
        vehiclesCount: vehicles.length,
        vehicleIds: vehicles.join(', '),
      },
      action: {
        label: 'View Details',
        url: `/accidents/${location.latitude},${location.longitude}`,
      },
    }
  );
}

/**
 * Create pollution alert notification
 */
export function createPollutionAlertNotification(
  aqi: number,
  location: { latitude: number; longitude: number },
  areaName: string
): Notification {
  let priority: NotificationPriority = 'low';
  let awareText = 'Low pollution levels.';

  if (aqi > 300) {
    priority = 'critical';
    awareText = 'Air quality is SEVERE. Avoid outdoor activities.';
  } else if (aqi > 200) {
    priority = 'high';
    awareText = 'Air quality is poor. Use air filtration systems.';
  } else if (aqi > 100) {
    priority = 'medium';
    awareText = 'Moderate pollution. Sensitive groups should be cautious.';
  }

  return createNotification(
    'pollution-alert',
    `Air Quality Alert: ${areaName}`,
    `AQI: ${Math.round(aqi)}. ${awareText}`,
    priority,
    {
      location,
      target: 'location-based',
      targetRadius: 10,
      metadata: {
        aqi,
        areaName,
      },
    }
  );
}

/**
 * Create signal override notification (EV override event)
 */
export function createSignalOverrideNotification(
  signalId: string,
  direction: string,
  reason: string,
  duration: number // seconds
): Notification {
  const voiceMessage = `Signal ${signalId} direction ${direction} is overriding. Reason: ${reason}. Duration: ${Math.ceil(duration / 60)} minutes.`;

  return createNotification(
    'signal-override',
    'Traffic Signal Override Active',
    `Signal ${signalId} (${direction}): ${reason}`,
    'high',
    {
      source: `signal-${signalId}`,
      target: 'nv',
      voice: {
        enabled: true,
        text: voiceMessage,
      },
      metadata: {
        signalId,
        direction,
        reason,
        duration,
      },
    }
  );
}

/**
 * Create emission-based route alert
 */
export function createEmissionWarningNotification(
  currentRoute: string,
  suggestedRoute: string,
  emissionSavings: number,
  timeSavings: number
): Notification {
  const voiceMessage = `High emissions detected on current route. Suggested alternative route saves ${emissionSavings.toFixed(0)} grams of CO2 and ${timeSavings.toFixed(0)} minutes.`;

  return createNotification(
    'emission-warning',
    'Eco-Friendly Route Available',
    `Switch route to save ${emissionSavings.toFixed(0)}g CO2 & ${timeSavings.toFixed(0)} min`,
    'medium',
    {
      voice: {
        enabled: true,
        text: voiceMessage,
      },
      metadata: {
        currentRoute,
        suggestedRoute,
        emissionSavings,
        timeSavings,
      },
      action: {
        label: 'Switch Route',
        callback: 'reroute',
      },
    }
  );
}

/**
 * Mark notification as read
 */
export function markNotificationAsRead(notificationId: string): Notification | null {
  const notification = NOTIFICATION_STORE.get(notificationId);
  if (notification) {
    notification.read = true;
    notification.readAt = new Date().toISOString();
    NOTIFICATION_STORE.set(notificationId, notification);
    return notification;
  }
  return null;
}

/**
 * Get notifications for a user/role
 */
export function getNotifications(
  target: NotificationTarget,
  unreadOnly: boolean = false,
  limit: number = 50
): NotificationQueue {
  let notifications = Array.from(NOTIFICATION_STORE.values()).filter(
    (n) => n.target === target || n.target === 'all'
  );

  if (unreadOnly) {
    notifications = notifications.filter((n) => !n.read);
  }

  // Sort by priority and timestamp
  notifications.sort((a, b) => {
    const priorityMap = { critical: 4, high: 3, medium: 2, low: 1 };
    const priorityDiff =
      (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  notifications = notifications.slice(0, limit);

  return {
    notifications,
    totalCount: NOTIFICATION_STORE.size,
    unreadCount: Array.from(NOTIFICATION_STORE.values()).filter((n) => !n.read).length,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get notifications by type
 */
export function getNotificationsByType(
  type: NotificationType,
  limit: number = 20
): Notification[] {
  return Array.from(NOTIFICATION_STORE.values())
    .filter((n) => n.type === type)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/**
 * Get location-based notifications
 */
export function getLocationBasedNotifications(
  latitude: number,
  longitude: number,
  radius: number // km
): Notification[] {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const distance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  return Array.from(NOTIFICATION_STORE.values())
    .filter((n) => {
      if (!n.location) return false;
      if (n.target !== 'location-based' && n.target !== 'all') return false;

      const dist = distance(
        latitude,
        longitude,
        n.location.latitude,
        n.location.longitude
      );
      return dist <= (n.targetRadius || radius);
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Clear old notifications (older than expiryTime)
 */
export function clearOldNotifications(expiryDays: number = 7): number {
  const expiryTime = Date.now() - expiryDays * 24 * 60 * 60 * 1000;
  let deleted = 0;

  for (const [id, notif] of NOTIFICATION_STORE) {
    if (new Date(notif.timestamp).getTime() < expiryTime) {
      NOTIFICATION_STORE.delete(id);
      deleted++;
    }
  }

  return deleted;
}

/**
 * Delete specific notification
 */
export function deleteNotification(notificationId: string): boolean {
  return NOTIFICATION_STORE.delete(notificationId);
}

/**
 * Get notification statistics
 */
export function getNotificationStats(): {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
} {
  const notifications = Array.from(NOTIFICATION_STORE.values());
  const byType: Record<NotificationType, number> = {
    'accident': 0,
    'ev-arrival': 0,
    'signal-override': 0,
    'route-alert': 0,
    'emission-warning': 0,
    'pollution-alert': 0,
    'emergency': 0,
    'info': 0,
  };
  const byPriority: Record<NotificationPriority, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  for (const notif of notifications) {
    byType[notif.type]++;
    byPriority[notif.priority]++;
  }

  return {
    total: notifications.length,
    unread: notifications.filter((n) => !n.read).length,
    byType,
    byPriority,
  };
}
