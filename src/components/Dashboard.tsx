import { motion } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardApi, connectWebSocket } from '@/lib/api'
import { useEffect } from 'react'
import TeamOverview from './TeamOverview'
import ApprovalQueue from './ApprovalQueue'
import ActivityFeed from './ActivityFeed'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Target, BarChart3 } from 'lucide-react'

export default function Dashboard() {
  const queryClient = useQueryClient()

  // Fetch dashboard data
  const { data: dashboardData, isLoading, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getDashboard().then(res => {
      console.log('📊 Dashboard data fetched:', res.data?.activity?.length, 'activities')
      return res.data
    }),
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000, // Data becomes stale after 5 seconds
    cacheTime: 0, // Don't cache
  })

  // Set up WebSocket for real-time updates
  useEffect(() => {
    const ws = connectWebSocket((data) => {
      console.log('📡 Real-time update:', data)
      // Show immediate notification
      const event = new CustomEvent('orange-hr-update', { detail: data })
      window.dispatchEvent(event)
      
      // Force immediate refetch
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.refetchQueries({ queryKey: ['dashboard'] })
    })

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }
  }, [queryClient])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  const team = dashboardData?.team || []
  const approvals = dashboardData?.approvals || []

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Orange HR Dashboard</h2>
              <p className="text-muted-foreground">
                Real-time visibility into team productivity and project progress
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse-subtle" />
              <span className="text-sm text-muted-foreground">Live updates active</span>
              <button 
                onClick={() => {
                  console.log('🔄 Manual refresh triggered')
                  refetch()
                }}
                className="text-xs bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-colors"
              >
                Refresh now
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Left column - 2/3 width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-2 space-y-6"
        >
          <TeamOverview team={team} />
          
          <Card className="shadow-soft-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Productivity Metrics
              </CardTitle>
              <CardDescription>
                Real metrics coming from GitHub/activity tracking
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[200px] overflow-y-auto">
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-3xl mb-2">📈</div>
                <p>Metrics will show real commit, PR, and issue data</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right column - 1/3 width - STACKED */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-6"
        >
          <Card className="shadow-soft-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Project Progress
              </CardTitle>
              <CardDescription>
                Real project data coming soon
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[200px] overflow-y-auto">
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-3xl mb-2">📊</div>
                <p>Project tracking will connect to real project management systems</p>
              </div>
            </CardContent>
          </Card>
          
          <ApprovalQueue approvals={approvals} />
          <ActivityFeed />
        </motion.div>
      </div>
    </div>
  )
}