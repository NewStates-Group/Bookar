import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CourseCard } from "@/components/course-card"
import { Search, Sparkles, Brain, Zap, TrendingUp } from "lucide-react"
import Link from "next/link"

const courses = [
  {
    id: 1,
    title: "Introduction to Machine Learning",
    description: "Master the fundamentals of ML algorithms, from linear regression to neural networks.",
    instructor: "Dr. Sarah Chen",
    duration: "8 weeks",
    level: "Beginner",
    students: 12453,
    rating: 4.8,
    image: "/ml-neural-network-visualization.png",
    category: "Machine Learning",
  },
  {
    id: 2,
    title: "Deep Learning Specialization",
    description: "Build and train deep neural networks for computer vision and NLP applications.",
    instructor: "Prof. Michael Zhang",
    duration: "12 weeks",
    level: "Advanced",
    students: 8921,
    rating: 4.9,
    image: "/deep-learning-neural-network-layers.jpg",
    category: "Deep Learning",
  },
  {
    id: 3,
    title: "Natural Language Processing",
    description: "Learn to build chatbots, sentiment analysis, and language models with transformers.",
    instructor: "Dr. Emily Rodriguez",
    duration: "10 weeks",
    level: "Intermediate",
    students: 10234,
    rating: 4.7,
    image: "/nlp-text-analysis.png",
    category: "NLP",
  },
  {
    id: 4,
    title: "Computer Vision Fundamentals",
    description: "Explore image processing, object detection, and facial recognition techniques.",
    instructor: "Dr. James Park",
    duration: "9 weeks",
    level: "Intermediate",
    students: 9567,
    rating: 4.8,
    image: "/computer-vision-object-detection.png",
    category: "Computer Vision",
  },
  {
    id: 5,
    title: "Reinforcement Learning",
    description: "Train AI agents to make decisions and master complex environments.",
    instructor: "Prof. Lisa Wang",
    duration: "11 weeks",
    level: "Advanced",
    students: 6789,
    rating: 4.9,
    image: "/reinforcement-learning-agent-training.jpg",
    category: "Reinforcement Learning",
  },
  {
    id: 6,
    title: "AI Ethics & Responsible AI",
    description: "Understand the ethical implications and best practices for deploying AI systems.",
    instructor: "Dr. Marcus Johnson",
    duration: "6 weeks",
    level: "Beginner",
    students: 11234,
    rating: 4.6,
    image: "/ai-ethics-responsible-artificial-intelligence.jpg",
    category: "Ethics",
  },
]

const categories = [
  { name: "All Courses", icon: Sparkles },
  { name: "Machine Learning", icon: Brain },
  { name: "Deep Learning", icon: Zap },
  { name: "NLP", icon: TrendingUp },
]

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">AI Academy</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">
              Courses
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              My Learning
            </Link>
            <Link
              href="/about"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              About
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
      <section className="py-20 px-4 bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto max-w-6xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            <span>Learn AI from Industry Experts</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-6 text-balance">Master Artificial Intelligence</h1>

          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-pretty">
            Build cutting-edge AI applications with hands-on courses in machine learning, deep learning, and neural
            networks.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button size="lg" className="w-full sm:w-auto">
              Explore Courses
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent">
              View Learning Paths
            </Button>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input placeholder="Search for courses, topics, or instructors..." className="pl-12 h-12 text-base" />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y border-border bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">50K+</div>
              <div className="text-sm text-muted-foreground">Active Students</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">200+</div>
              <div className="text-sm text-muted-foreground">Expert Instructors</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">500+</div>
              <div className="text-sm text-muted-foreground">AI Courses</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">4.8★</div>
              <div className="text-sm text-muted-foreground">Average Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            {categories.map((category) => {
              const Icon = category.icon
              return (
                <Button
                  key={category.name}
                  variant="outline"
                  className="flex items-center gap-2 whitespace-nowrap bg-transparent"
                >
                  <Icon className="w-4 h-4" />
                  {category.name}
                </Button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Courses Grid */}
      <section className="py-12 px-4 pb-20">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Popular Courses</h2>
              <p className="text-muted-foreground">Start your AI journey with our most loved courses</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold mb-3">Platform</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/courses" className="hover:text-foreground transition-colors">
                    Browse Courses
                  </Link>
                </li>
                <li>
                  <Link href="/paths" className="hover:text-foreground transition-colors">
                    Learning Paths
                  </Link>
                </li>
                <li>
                  <Link href="/instructors" className="hover:text-foreground transition-colors">
                    Instructors
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/about" className="hover:text-foreground transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/careers" className="hover:text-foreground transition-colors">
                    Careers
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="hover:text-foreground transition-colors">
                    Blog
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Support</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/help" className="hover:text-foreground transition-colors">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-foreground transition-colors">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="hover:text-foreground transition-colors">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/privacy" className="hover:text-foreground transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-foreground transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground">
            <p>© 2025 AI Academy. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
