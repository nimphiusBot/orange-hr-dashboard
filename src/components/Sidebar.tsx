import { Home, Users, BarChart3, Target, Clock, Settings, HelpCircle } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { icon: Home, label: 'Dashboard', active: true },
  { icon: Users, label: 'Team' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: Target, label: 'Projects' },
  { icon: Clock, label: 'Time Tracking' },
]

export default function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-64 border-r bg-background">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-storyhouse-orange to-storyhouse-blue flex items-center justify-center">
            <span className="text-white font-bold">HR</span>
          </div>
          <div>
            <h2 className="font-bold text-lg">Orange HR</h2>
            <p className="text-xs text-muted-foreground">Orange Doorhouse Inc</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 px-4">
        <div className="space-y-1">
          {navItems.map((item) => (
            <Button
              key={item.label}
              variant={item.active ? 'secondary' : 'ghost'}
              className={cn(
                "w-full justify-start gap-3",
                item.active && "bg-accent"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          ))}
        </div>
        
        <div className="mt-8 pt-8 border-t">
          <div className="space-y-1">
            <Button variant="ghost" className="w-full justify-start gap-3">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-3">
              <HelpCircle className="h-4 w-4" />
              Help & Support
            </Button>
          </div>
        </div>
      </nav>
      
      <div className="p-4 border-t">
        <div className="rounded-lg bg-gradient-to-r from-storyhouse-blue/10 to-storyhouse-purple/10 p-4">
          <p className="text-sm font-medium">Need more insights?</p>
          <p className="text-xs text-muted-foreground mt-1">
            Connect GitHub, Jira, or Linear for deeper analytics
          </p>
          <Button size="sm" className="w-full mt-3">
            Connect Tools
          </Button>
        </div>
      </div>
    </aside>
  )
}