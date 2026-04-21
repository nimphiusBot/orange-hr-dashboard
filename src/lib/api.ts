import axios from 'axios'

const API_BASE_URL = 'http://localhost:3003'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// WebSocket connection for real-time updates
let ws: WebSocket | null = null
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5

export function connectWebSocket(onMessage: (data: any) => void) {
  if (ws?.readyState === WebSocket.OPEN) {
    return ws
  }

  ws = new WebSocket('ws://localhost:3004')

  ws.onopen = () => {
    console.log('📡 WebSocket connected')
    reconnectAttempts = 0
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      onMessage(data)
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }

  ws.onclose = () => {
    console.log('📡 WebSocket disconnected')
    
    // Attempt to reconnect
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++
      console.log(`Reconnecting in ${reconnectAttempts * 1000}ms...`)
      setTimeout(() => connectWebSocket(onMessage), reconnectAttempts * 1000)
    }
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
  }

  return ws
}

export function disconnectWebSocket() {
  if (ws) {
    ws.close()
    ws = null
  }
}

// Dashboard API calls
export const dashboardApi = {
  // Get all dashboard data
  getDashboard: () => api.get('/api/dashboard'),
  
  // Get team data
  getTeam: () => api.get('/api/team'),
  
  // Get approvals
  getApprovals: () => api.get('/api/approvals'),
  
  // Get metrics
  getMetrics: () => api.get('/api/metrics'),
  
  // Get activity
  getActivity: () => api.get('/api/activity'),
  
  // Approve an item
  approveItem: (id: number) => api.post(`/api/approvals/${id}/approve`),
  
  // Update team member
  updateTeamMember: (id: number, data: any) => api.put(`/api/team/${id}`, data),
  
  // Get StoryHouse team data
  getStoryHouseTeam: () => api.get('/api/storyhouse/team'),
  
  // Health check
  health: () => api.get('/health'),
}

// Orange HR bot webhook URL (for the bot to send events)
export const ORANGE_HR_WEBHOOK_URL = `${API_BASE_URL}/webhook/orange-hr`