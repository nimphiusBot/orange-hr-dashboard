import { Activity, GitPullRequest, FileText, CheckCircle, MessageSquare, Zap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Badge } from './ui/badge'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/lib/api'

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'component':
      return <Zap className="h-4 w-4 text-blue-500" />
    case 'documentation':
      return <FileText className="h-4 w-4 text-green-500" />
    case 'testing':
      return <CheckCircle className="h-4 w-4 text-purple-500" />
    case 'approval':
      return <CheckCircle className="h-4 w-4 text-orange-500" />
    case 'pull_request':
      return <GitPullRequest className="h-4 w-4 text-indigo-500" />
    default:
      return <Activity className="h-4 w-4 text-gray-500" />
  }
}

const getActivityColor = (type: string) => {
  switch (type) {
    case 'component':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'documentation':
      return 'bg-green-50 text-green-700 border-green-200'
    case 'testing':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'approval':
      return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'pull_request':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

export default function ActivityFeed() {
  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getDashboard().then(res => res.data),
  })

  const activities = dashboardData?.activity || []
  return (
    <Card className="shadow-soft-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Recent Activity
        </CardTitle>
        <CardDescription>
          Real-time updates from your team
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-3xl mb-2">📝</div>
            <p>No recent activity</p>
            <p className="text-sm mt-1">Activity will appear here</p>
          </div>
        ) : (
          <div className={`space-y-6 ${activities.length > 3 ? 'max-h-[400px] overflow-y-auto pr-2' : ''}`}>
          {activities.map((activity) => (
            <div key={activity.id} className="flex gap-4 p-4 rounded-lg border hover:bg-accent/50 transition-colors">
              <Avatar className="h-10 w-10">
                <AvatarImage src={activity.avatar} />
                <AvatarFallback>{activity.user.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{activity.user}</span>
                  <Badge variant="outline" className={cn("text-xs", getActivityColor(activity.type))}>
                    <span className="flex items-center gap-1">
                      {getActivityIcon(activity.type)}
                      {activity.type}
                    </span>
                  </Badge>
                  <span className="text-sm text-muted-foreground ml-auto">{activity.time}</span>
                </div>
                
                <p className="mt-1">{activity.action}</p>
                <p className="text-sm text-muted-foreground mt-1">{activity.details}</p>
                
                <div className="flex items-center gap-4 mt-3">
                  <button className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    Comment
                  </button>
                  <button className="text-sm text-muted-foreground hover:text-foreground">
                    View details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
        
        {activities.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing last 6 activities • <button className="text-primary hover:underline">Load more</button>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse-subtle" />
              <span className="text-sm">Live updates active</span>
            </div>
          </div>
        </div>
        )}
      </CardContent>
    </Card>
  )
}