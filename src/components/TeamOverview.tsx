import { Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Badge } from './ui/badge'
import { cn, getStatusColor, getStatusLabel } from '@/lib/utils'

type TeamMember = {
  id: number
  name: string
  role: string
  status: string
  avatar: string
  // Optional context fields for better UX
  onboardingProgress?: number // 0-100 percentage
  onboardingDays?: string // e.g. "Day 2 of 7"
  joinDate?: string // ISO date string
}

interface TeamOverviewProps {
  team: TeamMember[]
}

export default function TeamOverview({ team }: TeamOverviewProps) {
  // Commenting out unused mutation for now
  // const updateMemberMutation = useMutation({
  //   mutationFn: ({ id, data }: { id: number; data: any }) => 
  //     dashboardApi.updateTeamMember(id, data),
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  //   },
  // })

  const activeMembers = team.filter(m => m.status === 'active').length
  // Note: Removed mock metrics (hoursToday, productivity, currentTask)
  // Real data only - these will come from actual tracking systems

  return (
    <Card className="shadow-soft-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Overview
            </CardTitle>
            <CardDescription>
              Real-time team status and productivity
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold">{activeMembers}/{team.length}</div>
              <div className="text-sm text-muted-foreground">Active</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{team.length}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {team.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div className={cn(
                    "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background",
                    getStatusColor(member.status)
                  )} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{member.name}</h4>
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      member.status === 'active' && "bg-green-500/10 text-green-700 border-green-200",
                      member.status === 'onboarding' && "bg-blue-500/10 text-blue-700 border-blue-200",
                    )}>
                      {getStatusLabel(member.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                  
                  {/* Contextual information */}
                  {member.status === 'onboarding' && member.onboardingDays && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{member.onboardingDays}</span>
                        {member.onboardingProgress && (
                          <span>{member.onboardingProgress}% complete</span>
                        )}
                      </div>
                      {member.onboardingProgress && (
                        <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full" 
                            style={{ width: `${member.onboardingProgress}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {member.status === 'active' && member.joinDate && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Joined {new Date(member.joinDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Metrics removed - real metrics will come from tracking systems */}
            </div>
          ))}
        </div>
        
        {/* Metrics section removed - real metrics will come from actual tracking systems */}
      </CardContent>
    </Card>
  )
}