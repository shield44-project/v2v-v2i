/**
 * Voice Notification System (TTS)
 * Generates and plays voice messages for alerts across all portals
 */

import React from 'react';

export interface VoiceNotificationConfig {
  enabled: boolean;
  language?: 'en' | 'hi' | 'es' | 'fr';
  rate?: number; // 0.5 - 2.0
  pitch?: number; // 0.5 - 2.0
  volume?: number; // 0 - 1
}

export interface VoiceMessage {
  id: string;
  text: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  played: boolean;
  config: VoiceNotificationConfig;
}

/**
 * Voice message templates for different scenarios
 */
const VOICE_TEMPLATES = {
  evArrival: {
    ambulance: (direction: string, eta: number) =>
      `Ambulance arriving from the ${direction}. Estimated time: ${Math.ceil(eta / 60)} minutes. Please clear the area for emergency vehicle passage.`,
    police: (direction: string, eta: number) =>
      `Police vehicle arriving from the ${direction}. ETA: ${Math.ceil(eta / 60)} minutes. Move to the side for emergency services.`,
    fire: (direction: string, eta: number) =>
      `Fire truck arriving from the ${direction}. Expected arrival in ${Math.ceil(eta / 60)} minutes. Clear the emergency route.`,
  },

  accidentAlert: {
    minor: () => 'Minor accident detected. Please maintain safe distance and follow traffic signals.',
    moderate: () => 'Moderate accident reported. Proceed with caution. Emergency services have been notified.',
    severe: () => 'SEVERE accident alert! Avoid this area if possible. Emergency services dispatched immediately.',
  },

  pollutionAlert: {
    low: () => 'Air quality is good. Safe for outdoor activities.',
    moderate: () => 'Moderate pollution levels. Sensitive groups may experience minor symptoms.',
    high: () => 'High pollution alert. Use air filtration in vehicles. Avoid prolonged outdoor exposure.',
    severe: () => 'SEVERE pollution warning. Keep windows closed. Use N95 masks if outdoors.',
  },

  trafficUpdate: (direction: string, status: string) =>
    `Traffic is ${status} on ${direction}. ${status === 'congested' ? 'Consider alternative route.' : 'Proceed normally.'}`,

  signalOverride: (direction: string) =>
    `Traffic signal override active on ${direction}. Emergency vehicle has priority. Please follow signal instructions.`,

  routeOptimization: (saved: number) =>
    `Optimized route available. This route will save ${saved} grams of CO2 emissions. Switch route? Say yes or no.`,
};

/**
 * Generate voice message for EV arrival
 */
export function generateEVArrivalMessage(
  evType: 'ambulance' | 'police' | 'fire',
  direction: string,
  eta: number
): string {
  return VOICE_TEMPLATES.evArrival[evType](direction, eta);
}

/**
 * Generate voice message for accident
 */
export function generateAccidentMessage(severity: 'minor' | 'moderate' | 'severe'): string {
  return VOICE_TEMPLATES.accidentAlert[severity]();
}

/**
 * Generate voice message for pollution alert
 */
export function generatePollutionMessage(
  severity: 'low' | 'moderate' | 'high' | 'severe'
): string {
  return VOICE_TEMPLATES.pollutionAlert[severity]();
}

/**
 * Play voice message using Web Speech API
 */
export async function playVoiceMessage(
  text: string,
  config: VoiceNotificationConfig = {
    enabled: true,
    language: 'en',
    rate: 1,
    pitch: 1,
    volume: 0.8,
  }
): Promise<boolean> {
  if (!config.enabled) return false;

  // Check if browser supports Web Speech API
  const SpeechSynthesisUtterance = window.SpeechSynthesisUtterance;
  const speechSynthesis = window.speechSynthesis;

  if (!SpeechSynthesisUtterance || !speechSynthesis) {
    console.warn('Speech Synthesis not supported in this browser');
    return false;
  }

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);

    // Set language
    utterance.lang = config.language === 'hi' ? 'hi-IN' : config.language === 'es' ? 'es-ES' : 'en-US';
    utterance.rate = config.rate || 1;
    utterance.pitch = config.pitch || 1;
    utterance.volume = config.volume || 0.8;

    utterance.onend = () => resolve(true);
    utterance.onerror = () => resolve(false);

    speechSynthesis.speak(utterance);
  });
}

/**
 * Play multiple voice messages in sequence
 */
export async function playVoiceMessageSequence(
  messages: string[],
  config: VoiceNotificationConfig = {
    enabled: true,
    language: 'en',
    rate: 1,
    pitch: 1,
    volume: 0.8,
  }
): Promise<boolean> {
  for (const message of messages) {
    const success = await playVoiceMessage(message, config);
    if (!success) return false;

    // Small delay between messages
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return true;
}

/**
 * Stop voice playback
 */
export function stopVoicePlayback(): void {
  const speechSynthesis = window.speechSynthesis;
  if (speechSynthesis) {
    speechSynthesis.cancelall();
  }
}

/**
 * Check browser support for voice synthesis
 */
export function isVoiceSupportedByBrowser(): boolean {
  return !!(window.SpeechSynthesisUtterance && window.speechSynthesis);
}

/**
 * Get available voices
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  const speechSynthesis = window.speechSynthesis;
  if (!speechSynthesis) return [];
  return speechSynthesis.getVoices();
}

/**
 * React Hook for voice notifications
 */
export function useVoiceNotification(config?: VoiceNotificationConfig) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [messages, setMessages] = React.useState<VoiceMessage[]>([]);

  const play = async (text: string, priority: 'low' | 'medium' | 'high' | 'critical' = 'medium') => {
    setIsPlaying(true);
    const message: VoiceMessage = {
      id: `msg-${Date.now()}`,
      text,
      priority,
      timestamp: new Date().toISOString(),
      played: true,
      config: config || { enabled: true },
    };

    setMessages((prev) => [...prev, message]);

    await playVoiceMessage(text, config);
    setIsPlaying(false);
  };

  const stop = () => {
    stopVoicePlayback();
    setIsPlaying(false);
  };

  const clear = () => {
    setMessages([]);
  };

  return { play, stop, clear, isPlaying, messages };
}

/**
 * Create notification sound alternative (for browsers without TTS support)
 */
export function playNotificationSound(type: 'alert' | 'warning' | 'critical'): void {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const now = audioContext.currentTime;

  // Create oscillator for beep
  const osc = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  osc.connect(gainNode);
  gainNode.connect(audioContext.destination);

  switch (type) {
    case 'alert':
      // Single beep
      osc.frequency.value = 800;
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;

    case 'warning':
      // Double beep
      for (let i = 0; i < 2; i++) {
        osc.frequency.value = 1000;
        gainNode.gain.setValueAtTime(0.3, now + i * 0.3);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2 + i * 0.3);
        osc.start(now + i * 0.3);
        osc.stop(now + 0.2 + i * 0.3);
      }
      break;

    case 'critical':
      // Urgent triple beep
      for (let i = 0; i < 3; i++) {
        osc.frequency.value = 1200;
        gainNode.gain.setValueAtTime(0.5, now + i * 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15 + i * 0.2);
        osc.start(now + i * 0.2);
        osc.stop(now + 0.15 + i * 0.2);
      }
      break;
  }
}
