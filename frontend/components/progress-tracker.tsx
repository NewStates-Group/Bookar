"use client"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useProgressStore } from "@/lib/progress-store"
import { Trophy, Clock, Target } from "lucide-react"

interface ProgressTrackerProps {
  courseId: number
  totalLessons: number
}

export function ProgressTracker({ courseId, totalLessons }: ProgressTrackerProps) {
  const { courses, calculateProgress } = useProgressStore()
  const courseProgress = courses[courseId]
  const progressPercentage = calculateProgress(courseId, totalLessons)

  if (!courseProgress) {
    return null
  }

  const completedLessons = courseProgress.completedLessons.length
  const watchTimeHours = Math.floor(courseProgress.totalWatchTime / 3600)
  const watchTimeMinutes = Math.floor((courseProgress.totalWatchTime % 3600) / 60)

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Your Progress</h3>
        <div className="flex items-center gap-2 text-primary">
          <Trophy className="w-5 h-5" />
          <span className="font-bold text-2xl">{progressPercentage}%</span>
        </div>
      </div>

      <Progress value={progressPercentage} className="h-3 mb-6" />

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="font-semibold">
              {completedLessons} / {totalLessons}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Watch Time</p>
            <p className="font-semibold">
              {watchTimeHours > 0 ? `${watchTimeHours}h ` : ""}
              {watchTimeMinutes}m
            </p>
          </div>
        </div>
      </div>

      {progressPercentage === 100 && (
        <div className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2 text-primary">
            <Trophy className="w-5 h-5" />
            <span className="font-semibold">Congratulations! Course completed!</span>
          </div>
        </div>
      )}
    </Card>
  )
}
