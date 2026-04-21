import { Target, Calendar, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Progress } from './ui/progress'

const projects = [
  {
    id: 1,
    name: 'StoryHouse Platform',
    status: 'in-progress',
    progress: 25,
    timeline: 'Week 1 of 8',
    tasks: {
      completed: 12,
      total: 48
    },
    team: ['Design System Engineer', 'Backend Team', 'Frontend Team']
  },
  {
    id: 2,
    name: 'Design System',
    status: 'in-progress',
    progress: 40,
    timeline: 'Week 1 of 4',
    tasks: {
      completed: 8,
      total: 20
    },
    team: ['Design System Engineer', 'Documentation Specialist']
  },
  {
    id: 3,
    name: 'Video Generation',
    status: 'planning',
    progress: 30,
    timeline: 'Week 1 of 6',
    tasks: {
      completed: 3,
      total: 24
    },
    team: ['Video Generation Assistant', 'Backend Team']
  },
  {
    id: 4,
    name: 'Distribution System',
    status: 'backlog',
    progress: 0,
    timeline: 'Not started',
    tasks: {
      completed: 0,
      total: 32
    },
    team: ['Frontend Team', 'Backend Team']
  }
]

export default function ProjectProgress() {
  const totalProgress = projects.reduce((sum, project) => sum + project.progress, 0) / projects.length
  
  return (
    <Card className="h-full shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Project Progress
        </CardTitle>
        <CardDescription>
          Overall progress: <span className="font-semibold">{totalProgress.toFixed(0)}%</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {projects.map((project) => (
            <div key={project.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{project.name}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {project.timeline}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{project.progress}%</div>
                  <div className="text-sm text-muted-foreground">
                    {project.tasks.completed}/{project.tasks.total} tasks
                  </div>
                </div>
              </div>
              
              <Progress value={project.progress} className="h-2" />
              
              <div className="text-sm text-muted-foreground">
                Team: {project.team.join(', ')}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="font-medium">Weekly Velocity</span>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">+18%</div>
              <div className="text-sm text-muted-foreground">From last week</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}