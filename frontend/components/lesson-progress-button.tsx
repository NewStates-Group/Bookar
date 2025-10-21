"use client"

import { Button } from "@/components/ui/button"
import { useProgressStore } from "@/lib/progress-store"
import { CheckCircle2, Circle } from "lucide-react"
import { useState } from "react"

interface LessonProgressButtonProps {
  courseId: number
  lessonId: number
  totalLessons: number
}

export function LessonProgressButton({ courseId, lessonId, totalLessons }: LessonProgressButtonProps) {
  const { isLessonCompleted, markLessonComplete, markLessonIncomplete, calculateProgress } = useProgressStore()
  const [isCompleted, setIsCompleted] = useState(isLessonCompleted(courseId, lessonId))

  const handleToggle = () => {
    if (isCompleted) {
      markLessonIncomplete(courseId, lessonId)
      setIsCompleted(false)
    } else {
      markLessonComplete(courseId, lessonId)
      setIsCompleted(true)
    }
  }

  return (
    <Button onClick={handleToggle} variant={isCompleted ? "default" : "outline"} size="sm">
      {isCompleted ? (
        <>
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Completed
        </>
      ) : (
        <>
          <Circle className="w-4 h-4 mr-2" />
          Mark Complete
        </>
      )}
    </Button>
  )
}
