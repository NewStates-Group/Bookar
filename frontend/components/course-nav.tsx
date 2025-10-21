"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { ChevronDown, ChevronUp, PlayCircle, CheckCircle2, Lock } from "lucide-react"
import Link from "next/link"

interface Lesson {
  id: number
  title: string
  duration: string
  completed: boolean
  locked: boolean
}

interface Module {
  id: number
  title: string
  lessons: Lesson[]
}

interface CourseNavProps {
  module: Module
  courseId: number
}

export function CourseNav({ module, courseId }: CourseNavProps) {
  const [isExpanded, setIsExpanded] = useState(module.id === 1)

  const completedCount = module.lessons.filter((l) => l.completed).length
  const totalCount = module.lessons.length

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3 text-left">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
            {module.id}
          </div>
          <div>
            <h3 className="font-semibold">{module.title}</h3>
            <p className="text-sm text-muted-foreground">
              {completedCount} / {totalCount} lessons completed
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-border">
          {module.lessons.map((lesson) => (
            <Link
              key={lesson.id}
              href={lesson.locked ? "#" : `/courses/${courseId}/lessons/${lesson.id}`}
              className={`flex items-center justify-between p-4 hover:bg-muted/50 transition-colors border-b border-border last:border-b-0 ${
                lesson.locked ? "cursor-not-allowed opacity-60" : ""
              }`}
              onClick={(e) => lesson.locked && e.preventDefault()}
            >
              <div className="flex items-center gap-3 flex-1">
                {lesson.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : lesson.locked ? (
                  <Lock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <PlayCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                )}
                <span className="text-sm font-medium">{lesson.title}</span>
              </div>
              <span className="text-xs text-muted-foreground">{lesson.duration}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  )
}
