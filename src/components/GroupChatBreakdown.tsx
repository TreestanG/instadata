import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getGroupMemberStats } from "@/lib/instagram-parser"
import type { Conversation } from "@/lib/instagram-parser"

interface GroupChatBreakdownProps {
  conversation: Conversation
}

export function GroupChatBreakdown({ conversation }: GroupChatBreakdownProps) {
  if (!conversation.isGroup) {
    return null
  }

  const memberStats = getGroupMemberStats(conversation)
  const totalMessages = memberStats.reduce((sum, m) => sum + m.count, 0)

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg">Member Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          <div className="space-y-3">
            {memberStats.map((stat, index) => (
              <div key={stat.member} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {index + 1}. {stat.member}
                  </span>
                  <span className="text-muted-foreground">
                    {stat.count.toLocaleString()} ({Math.round((stat.count / totalMessages) * 100)}%)
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${(stat.count / totalMessages) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
