import { BarChart3, GitPullRequest, FileText, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const weeklyData = [
  { day: 'Mon', commits: 8, prs: 2, issues: 3, docs: 5 },
  { day: 'Tue', commits: 12, prs: 4, issues: 2, docs: 8 },
  { day: 'Wed', commits: 10, prs: 3, issues: 4, docs: 6 },
  { day: 'Thu', commits: 15, prs: 5, issues: 1, docs: 10 },
  { day: 'Fri', commits: 9, prs: 2, issues: 3, docs: 7 },
  { day: 'Sat', commits: 4, prs: 1, issues: 0, docs: 3 },
  { day: 'Sun', commits: 2, prs: 0, issues: 0, docs: 1 },
]

const teamDistribution = [
  { name: 'Design System', value: 42, color: '#8A2BE2' },
  { name: 'Backend', value: 28, color: '#1A73E8' },
  { name: 'Frontend', value: 18, color: '#FF6B35' },
  { name: 'Documentation', value: 12, color: '#34A853' },
]

const metrics = [
  {
    title: 'Total Commits',
    value: '60',
    change: '+18%',
    icon: GitPullRequest,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
  },
  {
    title: 'PRs Merged',
    value: '17',
    change: '+12%',
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
  },
  {
    title: 'Issues Closed',
    value: '13',
    change: '+25%',
    icon: FileText,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-950/20',
  },
  {
    title: 'Docs Updated',
    value: '40',
    change: '+32%',
    icon: FileText,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20',
  },
]

export default function ProductivityMetrics() {
  return (
    <Card className="shadow-soft-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Productivity Metrics
            </CardTitle>
            <CardDescription>
              GitHub activity and team performance
            </CardDescription>
          </div>
          <Tabs defaultValue="week" className="w-[200px]">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {metrics.map((metric) => (
            <div
              key={metric.title}
              className={`${metric.bgColor} p-4 rounded-lg`}
            >
              <div className="flex items-center justify-between">
                <metric.icon className={`h-5 w-5 ${metric.color}`} />
                <span className="text-sm font-medium text-green-600">
                  {metric.change}
                </span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">{metric.value}</div>
                <div className="text-sm text-muted-foreground">{metric.title}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h4 className="font-semibold mb-4">Weekly Activity</h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                    }}
                  />
                  <Bar dataKey="commits" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="prs" fill="hsl(var(--green-500))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="issues" fill="hsl(var(--purple-500))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Work Distribution</h4>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={teamDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {teamDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {teamDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm">{item.name}</span>
                  <span className="text-sm font-medium ml-auto">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t">
          <h4 className="font-semibold mb-4">Velocity Trend</h4>
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={[
                  { week: 'W1', velocity: 65 },
                  { week: 'W2', velocity: 72 },
                  { week: 'W3', velocity: 68 },
                  { week: 'W4', velocity: 85 },
                  { week: 'W5', velocity: 78 },
                  { week: 'W6', velocity: 92 },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="velocity"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}