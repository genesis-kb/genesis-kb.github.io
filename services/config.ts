/**
 * API Configuration
 * Centralized configuration for backend API communication
 */

// API base URL - defaults to localhost for development
// In production, this should be set via environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const config = {
  apiUrl: API_BASE_URL,
  endpoints: {
    // Auth
    auth: {
      register: '/api/v1/auth/register',
      login: '/api/v1/auth/login',
      me: '/api/v1/auth/me',
    },
    // Transcripts
    conferencesSummary: '/api/v1/transcripts/conferences/summary',
    conferences: '/api/v1/transcripts/conferences',
    transcripts: '/api/v1/transcripts',
    search: '/api/v1/transcripts/search',
    meta: '/api/v1/transcripts/meta',

    // AI
    summary: '/api/v1/ai/summary',
    chat: '/api/v1/ai/chat',
    tts: '/api/v1/ai/tts',
    entities: '/api/v1/ai/entities',

    // Notes
    notes: '/api/v1/notes',

    // Audiobooks
    audiobooks: '/api/v1/audiobooks',
    audiobookProgress: '/api/v1/audiobooks/progress',
    playlists: '/api/v1/audiobooks/playlists',
    episodes: '/api/v1/audiobooks/episodes',

    // Health
    health: '/api/v1/health',
  },

  // Request timeout in milliseconds
  timeout: 30000,
};

export default config;
