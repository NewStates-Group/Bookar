"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, ChevronRight, CheckCircle2, BookOpen, FileText, Code, Download } from "lucide-react"
import Link from "next/link"
import { LessonProgressButton } from "@/components/lesson-progress-button"
import { useProgressStore } from "@/lib/progress-store"
import { useEffect } from "react"

const lessonData = {
  1: {
    id: 1,
    title: "What is Machine Learning?",
    courseId: 1,
    courseName: "Introduction to Machine Learning",
    moduleTitle: "Getting Started with Machine Learning",
    duration: "12:34",
    videoUrl: "/placeholder.svg?height=720&width=1280",
    description:
      "In this lesson, we'll explore the fundamental concepts of machine learning, understand what it is, and see real-world applications.",
    transcript: `Welcome to the first lesson of our Machine Learning course. Today, we're going to answer the fundamental question: What is Machine Learning?

Machine Learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed. Instead of following pre-programmed rules, ML algorithms use data to identify patterns and make decisions.

There are three main types of machine learning:
1. Supervised Learning - where we train models on labeled data
2. Unsupervised Learning - where models find patterns in unlabeled data
3. Reinforcement Learning - where agents learn through trial and error

Let's look at some real-world applications...`,
    resources: [
      { name: "Lesson Slides.pdf", size: "2.4 MB", type: "PDF" },
      { name: "Code Examples.zip", size: "1.1 MB", type: "ZIP" },
      { name: "Additional Reading.pdf", size: "890 KB", type: "PDF" },
    ],
    notes: "Key concepts covered: ML definition, types of learning, real-world applications",
    nextLesson: { id: 2, title: "Types of Machine Learning" },
    prevLesson: null,
  },
}

export default function LessonPage({
  params,
}: {
  params: { id: string; lessonId: string }
}) {
  const lesson = lessonData[params.lessonId as keyof typeof lessonData] || lessonData[1]
  const { updateCurrentLesson } = useProgressStore()

  useEffect(() => {
    updateCurrentLesson(lesson.courseId, lesson.id)
  }, [lesson.courseId, lesson.id, updateCurrentLesson])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href={`/courses/${lesson.courseId}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Course
            </Link>

            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              <span className="font-semibold hidden sm:inline">{lesson.courseName}</span>
            </div>

            <LessonProgressButton courseId={lesson.courseId} lessonId={lesson.id} totalLessons={14} />
          </div>
        </div>
      </header>

      {/* Video Player */}
      <div className="bg-black">
        <div className="container mx-auto">
          <div className="aspect-video relative bg-muted flex items-center justify-center">
            <div className="text-center text-white">
              <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4">
                <div className="w-0 h-0 border-t-8 border-t-transparent border-l-12 border-l-white border-b-8 border-b-transparent ml-1" />
              </div>
              <p className="text-sm text-white/80">Video Player</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lesson Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Lesson Header */}
          <div className="mb-8">
            <p className="text-sm text-muted-foreground mb-2">{lesson.moduleTitle}</p>
            <h1 className="text-3xl font-bold mb-3">{lesson.title}</h1>
            <p className="text-muted-foreground">{lesson.description}</p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mb-8 pb-8 border-b border-border">
            {lesson.prevLesson ? (
              <Link href={`/courses/${lesson.courseId}/lessons/${lesson.prevLesson.id}`}>
                <Button variant="outline">
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous Lesson
                </Button>
              </Link>
            ) : (
              <div />
            )}

            {lesson.nextLesson && (
              <Link href={`/courses/${lesson.courseId}/lessons/${lesson.nextLesson.id}`}>
                <Button>
                  Next Lesson
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="resources">Resources</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Lesson Overview</h3>
                <p className="text-muted-foreground leading-relaxed mb-6">{lesson.description}</p>

                <div className="space-y-3">
                  <h4 className="font-semibold">In this lesson you will learn:</h4>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        The fundamental definition of machine learning
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        Different types of machine learning approaches
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        Real-world applications of ML in various industries
                      </span>
                    </li>
                  </ul>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="transcript" className="mt-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Video Transcript</h3>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
                <div className="prose prose-sm max-w-none">
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{lesson.transcript}</p>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="resources" className="mt-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Downloadable Resources</h3>
                <div className="space-y-3">
                  {lesson.resources.map((resource, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {resource.type === "PDF" ? (
                          <FileText className="w-5 h-5 text-red-500" />
                        ) : (
                          <Code className="w-5 h-5 text-blue-500" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{resource.name}</p>
                          <p className="text-xs text-muted-foreground">{resource.size}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="mt-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Lesson Notes</h3>
                <div className="bg-muted/50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-muted-foreground">{lesson.notes}</p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Your Notes</h4>
                  <textarea
                    className="w-full min-h-32 p-3 rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Take notes while watching the lesson..."
                  />
                  <Button size="sm">Save Notes</Button>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
