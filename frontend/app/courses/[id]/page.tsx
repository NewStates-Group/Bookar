import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Star, Users, Clock, PlayCircle, CheckCircle2, BookOpen, Award, Globe } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { CourseNav } from "@/components/course-nav"
import { ProgressTracker } from "@/components/progress-tracker"

const courseData = {
  1: {
    id: 1,
    title: "Introduction to Machine Learning",
    description:
      "Master the fundamentals of ML algorithms, from linear regression to neural networks. This comprehensive course will take you from beginner to proficient in machine learning concepts and practical applications.",
    instructor: "Dr. Sarah Chen",
    instructorBio: "PhD in Computer Science from MIT, 15+ years of experience in AI research and teaching.",
    instructorImage: "/placeholder.svg?height=100&width=100",
    duration: "8 weeks",
    level: "Beginner",
    students: 12453,
    rating: 4.8,
    reviews: 2341,
    image: "/placeholder.svg?height=400&width=800",
    category: "Machine Learning",
    language: "English",
    lastUpdated: "January 2025",
    modules: [
      {
        id: 1,
        title: "Getting Started with Machine Learning",
        lessons: [
          { id: 1, title: "What is Machine Learning?", duration: "12:34", completed: true, locked: false },
          { id: 2, title: "Types of Machine Learning", duration: "15:22", completed: true, locked: false },
          { id: 3, title: "Setting Up Your Environment", duration: "18:45", completed: false, locked: false },
          { id: 4, title: "Your First ML Model", duration: "22:10", completed: false, locked: false },
        ],
      },
      {
        id: 2,
        title: "Supervised Learning Fundamentals",
        lessons: [
          { id: 5, title: "Linear Regression", duration: "20:15", completed: false, locked: false },
          { id: 6, title: "Logistic Regression", duration: "18:30", completed: false, locked: false },
          { id: 7, title: "Decision Trees", duration: "25:40", completed: false, locked: false },
          { id: 8, title: "Random Forests", duration: "22:55", completed: false, locked: false },
        ],
      },
      {
        id: 3,
        title: "Unsupervised Learning",
        lessons: [
          { id: 9, title: "K-Means Clustering", duration: "19:20", completed: false, locked: true },
          { id: 10, title: "Hierarchical Clustering", duration: "17:45", completed: false, locked: true },
          { id: 11, title: "Principal Component Analysis", duration: "24:30", completed: false, locked: true },
        ],
      },
      {
        id: 4,
        title: "Neural Networks Basics",
        lessons: [
          { id: 12, title: "Introduction to Neural Networks", duration: "21:15", completed: false, locked: true },
          { id: 13, title: "Backpropagation", duration: "26:40", completed: false, locked: true },
          { id: 14, title: "Building Your First Neural Network", duration: "30:20", completed: false, locked: true },
        ],
      },
    ],
    whatYouWillLearn: [
      "Understand the fundamentals of machine learning algorithms",
      "Build and train supervised learning models",
      "Apply unsupervised learning techniques",
      "Create neural networks from scratch",
      "Evaluate and optimize ML models",
      "Deploy machine learning solutions",
    ],
    requirements: [
      "Basic Python programming knowledge",
      "Understanding of high school mathematics",
      "A computer with internet connection",
    ],
  },
}

export default function CoursePage({ params }: { params: { id: string } }) {
  const course = courseData[params.id as keyof typeof courseData] || courseData[1]

  const totalLessons = course.modules.reduce((acc, module) => acc + module.lessons.length, 0)
  const completedLessons = course.modules.reduce(
    (acc, module) => acc + module.lessons.filter((l) => l.completed).length,
    0,
  )
  const progressPercentage = (completedLessons / totalLessons) * 100

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
            <Link
              href="/dashboard"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
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

      {/* Course Hero */}
      <section className="bg-muted/30 border-b border-border">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl">
            <div className="flex items-center gap-2 mb-4">
              <Badge>{course.category}</Badge>
              <Badge variant="outline">{course.level}</Badge>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-balance">{course.title}</h1>

            <p className="text-lg text-muted-foreground mb-6 text-pretty">{course.description}</p>

            <div className="flex flex-wrap items-center gap-6 mb-6">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{course.rating}</span>
                <span className="text-muted-foreground">({course.reviews.toLocaleString()} reviews)</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-5 h-5" />
                <span>{course.students.toLocaleString()} students</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-5 h-5" />
                <span>{course.duration}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" className="w-full sm:w-auto">
                <PlayCircle className="w-5 h-5 mr-2" />
                Start Learning
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent">
                Preview Course
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Course Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Progress Tracker */}
            <ProgressTracker courseId={course.id} totalLessons={totalLessons} />

            {/* Tabs */}
            <Tabs defaultValue="curriculum" className="w-full">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="instructor">Instructor</TabsTrigger>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
              </TabsList>

              <TabsContent value="curriculum" className="mt-6 space-y-4">
                {course.modules.map((module) => (
                  <CourseNav key={module.id} module={module} courseId={course.id} />
                ))}
              </TabsContent>

              <TabsContent value="overview" className="mt-6 space-y-6">
                <div>
                  <h3 className="text-xl font-semibold mb-4">What you'll learn</h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {course.whatYouWillLearn.map((item, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-4">Requirements</h3>
                  <ul className="space-y-2">
                    {course.requirements.map((req, index) => (
                      <li key={index} className="flex items-start gap-3 text-sm text-muted-foreground">
                        <span className="text-foreground">•</span>
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-semibold mb-4">Course Description</h3>
                  <p className="text-muted-foreground leading-relaxed">{course.description}</p>
                </div>
              </TabsContent>

              <TabsContent value="instructor" className="mt-6">
                <Card className="p-6">
                  <div className="flex items-start gap-4">
                    <Image
                      src={course.instructorImage || "/placeholder.svg"}
                      alt={course.instructor}
                      width={80}
                      height={80}
                      className="rounded-full"
                    />
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{course.instructor}</h3>
                      <p className="text-muted-foreground mb-4">{course.instructorBio}</p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span>{course.rating} Instructor Rating</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>{course.students.toLocaleString()} Students</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <PlayCircle className="w-4 h-4" />
                          <span>5 Courses</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="reviews" className="mt-6">
                <div className="space-y-6">
                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <div className="text-5xl font-bold mb-2">{course.rating}</div>
                      <div className="flex items-center gap-1 mb-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <div className="text-sm text-muted-foreground">Course Rating</div>
                    </div>
                    <div className="flex-1">
                      <p className="text-muted-foreground">Based on {course.reviews.toLocaleString()} reviews</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Card key={i} className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-semibold">
                            U{i}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold">User {i}</span>
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, j) => (
                                  <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                ))}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Excellent course! The instructor explains complex concepts in a very clear and
                              understandable way.
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Course Info Card */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-24">
              <div className="aspect-video relative rounded-lg overflow-hidden mb-6 bg-muted">
                <Image src={course.image || "/placeholder.svg"} alt={course.title} fill className="object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Button size="lg" className="rounded-full w-16 h-16">
                    <PlayCircle className="w-8 h-8" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Level</span>
                  <span className="font-medium">{course.level}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{course.duration}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Lessons</span>
                  <span className="font-medium">{totalLessons}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Language</span>
                  <span className="font-medium flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    {course.language}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Certificate</span>
                  <span className="font-medium flex items-center gap-1">
                    <Award className="w-4 h-4" />
                    Yes
                  </span>
                </div>
              </div>

              <Button className="w-full mb-3" size="lg">
                Enroll Now
              </Button>
              <Button className="w-full bg-transparent" variant="outline" size="lg">
                Add to Wishlist
              </Button>

              <p className="text-xs text-center text-muted-foreground mt-4">Last updated {course.lastUpdated}</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
