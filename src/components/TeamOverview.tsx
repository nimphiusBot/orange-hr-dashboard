import { Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Badge } from './ui/badge'
import { cn } from '@/lib/utils'

/**
 * Derived status computed from real data — no mock values.
 * - working: has a currentTask from Linear
 * - available: approved/hired but no current task
 * - onboarding: in the onboarding flow
 */
type DerivedStatus = 'working' | 'available' | 'onboarding'

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
  workingSince?: string // ISO date string
  currentTask?: string // What they're working on (from Linear issue title)
  ticketNumber?: string // Associated ticket/issue (from Linear identifier)
}

interface TeamOverviewProps {
  team: TeamMember[]
}

function deriveStatus(member: TeamMember): DerivedStatus {
  if (member.onboardingDays || member.status === 'onboarding') return 'onboarding'
  if (member.currentTask) return 'working'
  return 'available'
}

function getStatusBadge(status: DerivedStatus) {
  switch (status) {
    case 'working':
      return { label: 'Working', color: 'bg-green-500/10 text-green-700 border-green-200', dot: 'bg-green-500' }
    case 'available':
      return { label: 'Available', color: 'bg-amber-500/10 text-amber-700 border-amber-200', dot: 'bg-amber-500' }
    case 'onboarding':
      return { label: 'Onboarding', color: 'bg-blue-500/10 text-blue-700 border-blue-200', dot: 'bg-blue-500' }
  }
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

export default function TeamOverview({ team }: TeamOverviewProps) {
  const workingCount = team.filter(m => deriveStatus(m) === 'working').length

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
              <div className="text-2xl font-bold">{workingCount}/{team.length}</div>
              <div className="text-sm text-muted-foreground">Working</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{team.length}</div>
              <div className="text-sm text-muted-foreground">Hired</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {team.map((member) => {
            const status = deriveStatus(member)
            const badge = getStatusBadge(status)
            
            return (
            <div key={member.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div className={cn(
                    "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background",
                    badge.dot
                  )} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{member.name}</h4>
                    <Badge variant="outline" className={cn("text-xs", badge.color)}>
                      {badge.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                  
                  {/* Working agent: show current task + ticket + duration */}
                  {status === 'working' && (
                    <div className="mt-2 space-y-1">
                      {member.currentTask && (
                        <div className="text-xs text-muted-foreground truncate max-w-[320px]">
                          📋 {member.currentTask}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {member.ticketNumber && <span>🎫 {member.ticketNumber}</span>}
                        {member.workingSince && (
                          <span>⏱ {timeAgo(member.workingSince)}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Available agent: show join date */}
                  {status === 'available' && member.joinDate && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Hired {new Date(member.joinDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  )}

                  {/* Onboarding agent: show progress */}
                  {status === 'onboarding' && member.onboardingDays && (
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
                </div>
              </div>
            </div>
            )
          })}
        </div>
        
        {/* Metrics section removed - real metrics will come from actual tracking systems */}
      </CardContent>
    </Card>
  )
}