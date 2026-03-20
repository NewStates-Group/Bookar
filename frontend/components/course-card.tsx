import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, Users, Clock } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

interface Course {
  id: string
  title: string
  description: string
  instructor: string
  duration: string
  level: string
  students: number
  rating: number
  image: string
  category: string
}

interface CourseCardProps {
  course: Course
}

export function CourseCard({ course }: CourseCardProps) {
  return (
    <Link href={`/courses/${course.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
        <div className="relative h-48 w-full overflow-hidden bg-muted">
          <Image src={course.image || "/placeholder.svg"} alt={course.title} fill className="object-cover" />
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="bg-background/90 backdrop-blur">
              {course.category}
            </Badge>
          </div>
        </div>

        <div className="p-5 flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="text-xs">
              {course.level}
            </Badge>
            <div className="flex items-center gap-1 text-sm">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{course.rating}</span>
            </div>
          </div>

          <h3 className="text-lg font-semibold mb-2 line-clamp-2 text-balance">{course.title}</h3>

          <p className="text-sm text-muted-foreground mb-4 line-clamp-2 flex-1">{course.description}</p>

          <div className="space-y-2 pt-4 border-t border-border">
            <p className="text-sm font-medium">{course.instructor}</p>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span>{course.students.toLocaleString()} students</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{course.duration}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
