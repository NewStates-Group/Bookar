"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BookOpen, Clock, Trophy, PlayCircle, Award, Target, Plus, Upload, Edit, Trash2 } from "lucide-react"
import Link from "next/link"
import { useProgressStore } from "@/lib/progress-store"
import Image from "next/image"
import { useState } from "react"

const allCourses = [
  {
    id: 1,
    title: "Introduction to Machine Learning",
    instructor: "Dr. Sarah Chen",
    image: "/placeholder.svg?height=200&width=400",
    totalLessons: 14,
    category: "Machine Learning",
  },
  {
    id: 2,
    title: "Deep Learning Specialization",
    instructor: "Prof. Michael Zhang",
    image: "/placeholder.svg?height=200&width=400",
    totalLessons: 20,
    category: "Deep Learning",
  },
]

export default function DashboardPage() {
  const { courses, calculateProgress } = useProgressStore()
  const [createdCourses, setCreatedCourses] = useState<any[]>([])
  const [newCourse, setNewCourse] = useState({
    title: "",
    description: "",
    category: "",
    instructor: "",
    totalLessons: "",
    price: "",
    image: "",
  })

  const enrolledCourses = allCourses.filter((course) => courses[course.id])

  const totalCoursesEnrolled = enrolledCourses.length
  const totalLessonsCompleted = Object.values(courses).reduce((acc, course) => acc + course.completedLessons.length, 0)
  const totalWatchTime = Object.values(courses).reduce((acc, course) => acc + course.totalWatchTime, 0)
  const totalWatchHours = Math.floor(totalWatchTime / 3600)
  const totalWatchMinutes = Math.floor((totalWatchTime % 3600) / 60)

  const completedCourses = enrolledCourses.filter((course) => calculateProgress(course.id, course.totalLessons) === 100)

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault()
    const course = {
      id: Date.now(),
      ...newCourse,
      totalLessons: Number.parseInt(newCourse.totalLessons),
      price: Number.parseFloat(newCourse.price) || 0,
      image: newCourse.image || "/placeholder.svg?height=200&width=400",
      createdAt: new Date().toISOString(),
    }
    setCreatedCourses([...createdCourses, course])
    setNewCourse({
      title: "",
      description: "",
      category: "",
      instructor: "",
      totalLessons: "",
      price: "",
      image: "",
    })
  }

  const handleDeleteCourse = (id: number) => {
    setCreatedCourses(createdCourses.filter((course) => course.id !== id))
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
              <BookOpen className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">AI Academy</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Courses
            </Link>
            <Link href="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
              My Learning
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 px-4 bg-gradient-to-b from-background to-muted/20 border-b border-border">
        <div className="container mx-auto max-w-6xl">
          <h1 className="text-4xl font-bold mb-2">My Learning Dashboard</h1>
          <p className="text-muted-foreground">Track your progress and continue your AI learning journey</p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Enrolled Courses</p>
                  <p className="text-2xl font-bold">{totalCoursesEnrolled}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lessons Completed</p>
                  <p className="text-2xl font-bold">{totalLessonsCompleted}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Watch Time</p>
                  <p className="text-2xl font-bold">
                    {totalWatchHours > 0 ? `${totalWatchHours}h ` : ""}
                    {totalWatchMinutes}m
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                  <Trophy className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{completedCourses.length}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-8 px-4 pb-20">
        <div className="container mx-auto max-w-6xl">
          <Tabs defaultValue="in-progress" className="w-full">
            <TabsList>
              <TabsTrigger value="in-progress">In Progress</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="all">All Courses</TabsTrigger>
              <TabsTrigger value="my-courses">My Courses</TabsTrigger>
              <TabsTrigger value="create">Create Course</TabsTrigger>
            </TabsList>

            <TabsContent value="in-progress" className="mt-6">
              {enrolledCourses.filter((course) => calculateProgress(course.id, course.totalLessons) < 100).length ===
              0 ? (
                <Card className="p-12 text-center">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No courses in progress</h3>
                  <p className="text-muted-foreground mb-6">Start learning by enrolling in a course</p>
                  <Link href="/">
                    <Button>Browse Courses</Button>
                  </Link>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {enrolledCourses
                    .filter((course) => calculateProgress(course.id, course.totalLessons) < 100)
                    .map((course) => {
                      const progress = calculateProgress(course.id, course.totalLessons)
                      const courseProgress = courses[course.id]
                      const completedLessons = courseProgress?.completedLessons.length || 0

                      return (
                        <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                          <div className="relative h-48 w-full bg-muted">
                            <Image
                              src={course.image || "/placeholder.svg"}
                              alt={course.title}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="p-6">
                            <div className="mb-3">
                              <h3 className="text-lg font-semibold mb-1 line-clamp-2">{course.title}</h3>
                              <p className="text-sm text-muted-foreground">{course.instructor}</p>
                            </div>

                            <div className="space-y-3 mb-4">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-semibold">{progress}%</span>
                              </div>
                              <Progress value={progress} className="h-2" />
                              <p className="text-xs text-muted-foreground">
                                {completedLessons} of {course.totalLessons} lessons completed
                              </p>
                            </div>

                            <Link href={`/courses/${course.id}`}>
                              <Button className="w-full">
                                <PlayCircle className="w-4 h-4 mr-2" />
                                Continue Learning
                              </Button>
                            </Link>
                          </div>
                        </Card>
                      )
                    })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-6">
              {completedCourses.length === 0 ? (
                <Card className="p-12 text-center">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mx-auto mb-4">
                    <Trophy className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No completed courses yet</h3>
                  <p className="text-muted-foreground mb-6">Keep learning to earn your first certificate</p>
                  <Link href="/">
                    <Button>Browse Courses</Button>
                  </Link>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {completedCourses.map((course) => {
                    const courseProgress = courses[course.id]

                    return (
                      <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <div className="relative h-48 w-full bg-muted">
                          <Image
                            src={course.image || "/placeholder.svg"}
                            alt={course.title}
                            fill
                            className="object-cover"
                          />
                          <div className="absolute top-4 right-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500 text-white text-sm font-medium">
                              <Trophy className="w-4 h-4" />
                              Completed
                            </div>
                          </div>
                        </div>
                        <div className="p-6">
                          <div className="mb-4">
                            <h3 className="text-lg font-semibold mb-1 line-clamp-2">{course.title}</h3>
                            <p className="text-sm text-muted-foreground">{course.instructor}</p>
                          </div>

                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                            <Award className="w-4 h-4" />
                            <span>Certificate earned</span>
                          </div>

                          <div className="flex gap-2">
                            <Link href={`/courses/${course.id}`} className="flex-1">
                              <Button variant="outline" className="w-full bg-transparent">
                                Review Course
                              </Button>
                            </Link>
                            <Button className="flex-1">
                              <Award className="w-4 h-4 mr-2" />
                              Certificate
                            </Button>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="all" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {allCourses.map((course) => {
                  const isEnrolled = courses[course.id]
                  const progress = isEnrolled ? calculateProgress(course.id, course.totalLessons) : 0
                  const completedLessons = isEnrolled ? courses[course.id].completedLessons.length : 0

                  return (
                    <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="relative h-48 w-full bg-muted">
                        <Image
                          src={course.image || "/placeholder.svg"}
                          alt={course.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="p-6">
                        <div className="mb-3">
                          <h3 className="text-lg font-semibold mb-1 line-clamp-2">{course.title}</h3>
                          <p className="text-sm text-muted-foreground">{course.instructor}</p>
                        </div>

                        {isEnrolled ? (
                          <>
                            <div className="space-y-3 mb-4">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-semibold">{progress}%</span>
                              </div>
                              <Progress value={progress} className="h-2" />
                              <p className="text-xs text-muted-foreground">
                                {completedLessons} of {course.totalLessons} lessons completed
                              </p>
                            </div>

                            <Link href={`/courses/${course.id}`}>
                              <Button className="w-full">
                                <PlayCircle className="w-4 h-4 mr-2" />
                                {progress === 100 ? "Review Course" : "Continue Learning"}
                              </Button>
                            </Link>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-muted-foreground mb-4">
                              {course.totalLessons} lessons • {course.category}
                            </p>
                            <Link href={`/courses/${course.id}`}>
                              <Button className="w-full bg-transparent" variant="outline">
                                View Course
                              </Button>
                            </Link>
                          </>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>

            <TabsContent value="my-courses" className="mt-6">
              {createdCourses.length === 0 ? (
                <Card className="p-12 text-center">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No courses created yet</h3>
                  <p className="text-muted-foreground mb-6">Create your first course to share your knowledge</p>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Course
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {createdCourses.map((course) => (
                    <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="relative h-48 w-full bg-muted">
                        <Image
                          src={course.image || "/placeholder.svg"}
                          alt={course.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="p-6">
                        <div className="mb-3">
                          <h3 className="text-lg font-semibold mb-1 line-clamp-2">{course.title}</h3>
                          <p className="text-sm text-muted-foreground">{course.instructor}</p>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                          <span>{course.totalLessons} lessons</span>
                          <span>•</span>
                          <span>{course.category}</span>
                          {course.price > 0 && (
                            <>
                              <span>•</span>
                              <span>${course.price}</span>
                            </>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" className="flex-1 bg-transparent">
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 bg-transparent text-destructive hover:text-destructive"
                            onClick={() => handleDeleteCourse(course.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="create" className="mt-6">
              <Card className="max-w-3xl mx-auto">
                <div className="p-8">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-2">Create New Course</h2>
                    <p className="text-muted-foreground">Fill in the details to create your course</p>
                  </div>

                  <form onSubmit={handleCreateCourse} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="title">Course Title</Label>
                      <Input
                        id="title"
                        placeholder="e.g., Advanced Machine Learning Techniques"
                        value={newCourse.title}
                        onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Describe what students will learn in this course..."
                        rows={4}
                        value={newCourse.description}
                        onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <Select
                          value={newCourse.category}
                          onValueChange={(value) => setNewCourse({ ...newCourse, category: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Machine Learning">Machine Learning</SelectItem>
                            <SelectItem value="Deep Learning">Deep Learning</SelectItem>
                            <SelectItem value="Natural Language Processing">Natural Language Processing</SelectItem>
                            <SelectItem value="Computer Vision">Computer Vision</SelectItem>
                            <SelectItem value="Reinforcement Learning">Reinforcement Learning</SelectItem>
                            <SelectItem value="AI Ethics">AI Ethics</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="instructor">Instructor Name</Label>
                        <Input
                          id="instructor"
                          placeholder="Your name"
                          value={newCourse.instructor}
                          onChange={(e) => setNewCourse({ ...newCourse, instructor: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="lessons">Number of Lessons</Label>
                        <Input
                          id="lessons"
                          type="number"
                          min="1"
                          placeholder="e.g., 12"
                          value={newCourse.totalLessons}
                          onChange={(e) => setNewCourse({ ...newCourse, totalLessons: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="price">Price (USD)</Label>
                        <Input
                          id="price"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="e.g., 49.99 (leave empty for free)"
                          value={newCourse.price}
                          onChange={(e) => setNewCourse({ ...newCourse, price: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="image">Course Image URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="image"
                          type="url"
                          placeholder="https://example.com/image.jpg"
                          value={newCourse.image}
                          onChange={(e) => setNewCourse({ ...newCourse, image: e.target.value })}
                        />
                        <Button type="button" variant="outline" size="icon">
                          <Upload className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Recommended size: 800x400px. Leave empty to use placeholder.
                      </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button type="submit" className="flex-1">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Course
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-transparent"
                        onClick={() =>
                          setNewCourse({
                            title: "",
                            description: "",
                            category: "",
                            instructor: "",
                            totalLessons: "",
                            price: "",
                            image: "",
                          })
                        }
                      >
                        Clear
                      </Button>
                    </div>
                  </form>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  )
}
