import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { cn } from '@/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dashboardApi } from '@/lib/api'

type Approval = {
  id: number
  type: string
  title: string
  description: string
  requester: string
  cost: number
  status: string
  time: string
  priority: string
}

interface ApprovalQueueProps {
  approvals: Approval[]
}

export default function ApprovalQueue({ approvals }: ApprovalQueueProps) {
  const queryClient = useQueryClient()
  
  const approveMutation = useMutation({
    mutationFn: (id: number) => dashboardApi.approveItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const pendingCount = approvals.filter(a => a.status === 'pending').length
  const approvedCount = approvals.filter(a => a.status === 'approved').length
  const approvalRate = approvals.length > 0 
    ? Math.round((approvedCount / approvals.length) * 100)
    : 100
  
  const handleApprove = (id: number) => {
    approveMutation.mutate(id)
  }

  return (
    <Card className="shadow-soft-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Approval Queue
            </CardTitle>
            <CardDescription>
              <span className="font-semibold">{pendingCount}</span> pending approvals
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            Attention needed
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {approvals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-3xl mb-2">✅</div>
            <p>No pending approvals</p>
            <p className="text-sm mt-1">All requests are processed</p>
          </div>
        ) : (
          <div className={`space-y-4 ${approvals.length > 3 ? 'max-h-[400px] overflow-y-auto pr-2' : ''}`}>
          {approvals.map((approval) => (
            <div
              key={approval.id}
              className={cn(
                "p-4 rounded-lg border transition-all hover:shadow-md",
                approval.status === 'pending' && "bg-gradient-to-r from-orange-50/50 to-transparent dark:from-orange-950/10",
                approval.status === 'approved' && "bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10",
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{approval.title}</h4>
                    {approval.priority === 'high' && (
                      <Badge variant="destructive" className="text-xs">High</Badge>
                    )}
                    {approval.priority === 'medium' && (
                      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">Medium</Badge>
                    )}
                    {approval.status === 'approved' && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Approved
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{approval.description}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">By: {approval.requester}</span>
                    {approval.cost > 0 && (
                      <span className="font-medium">Cost: ${approval.cost.toFixed(2)}</span>
                    )}
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {approval.time}
                    </span>
                  </div>
                </div>
                
                {approval.status === 'pending' && (
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                      onClick={() => handleApprove(approval.id)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      {approveMutation.isPending ? 'Approving...' : 'Approve'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Deny
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
        
        {approvals.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <div>
                <div className="font-medium">Average Response Time</div>
                <div className="text-sm text-muted-foreground">4.2 hours</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{approvalRate}%</div>
              <div className="text-sm text-muted-foreground">Approval Rate</div>
            </div>
          </div>
        </div>
        )}
      </CardContent>
    </Card>
  )
}