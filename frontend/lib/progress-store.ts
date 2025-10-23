"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface LessonProgress {
  lessonId: number
  completed: boolean
  lastWatched: number // timestamp
  watchTime: number // seconds watched
}

interface CourseProgress {
  courseId: number
  enrolledAt: number // timestamp
  lastAccessedAt: number // timestamp
  completedLessons: number[]
  currentLesson: number | null
  totalWatchTime: number // total seconds watched
  progress: number // percentage 0-100
}

interface ProgressState {
  courses: Record<number, CourseProgress>
  enrollCourse: (courseId: number) => void
  markLessonComplete: (courseId: number, lessonId: number) => void
  markLessonIncomplete: (courseId: number, lessonId: number) => void
  updateCurrentLesson: (courseId: number, lessonId: number) => void
  updateWatchTime: (courseId: number, lessonId: number, seconds: number) => void
  getCourseProgress: (courseId: number) => CourseProgress | null
  isLessonCompleted: (courseId: number, lessonId: number) => boolean
  calculateProgress: (courseId: number, totalLessons: number) => number
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      courses: {},

      enrollCourse: (courseId) => {
        const now = Date.now()
        set((state) => ({
          courses: {
            ...state.courses,
            [courseId]: {
              courseId,
              enrolledAt: now,
              lastAccessedAt: now,
              completedLessons: [],
              currentLesson: null,
              totalWatchTime: 0,
              progress: 0,
            },
          },
        }))
      },

      markLessonComplete: (courseId, lessonId) => {
        set((state) => {
          const course = state.courses[courseId]
          if (!course) return state

          const completedLessons = course.completedLessons.includes(lessonId)
            ? course.completedLessons
            : [...course.completedLessons, lessonId]

          return {
            courses: {
              ...state.courses,
              [courseId]: {
                ...course,
                completedLessons,
                lastAccessedAt: Date.now(),
              },
            },
          }
        })
      },

      markLessonIncomplete: (courseId, lessonId) => {
        set((state) => {
          const course = state.courses[courseId]
          if (!course) return state

          return {
            courses: {
              ...state.courses,
              [courseId]: {
                ...course,
                completedLessons: course.completedLessons.filter((id) => id !== lessonId),
                lastAccessedAt: Date.now(),
              },
            },
          }
        })
      },

      updateCurrentLesson: (courseId, lessonId) => {
        set((state) => {
          const course = state.courses[courseId]
          if (!course) {
            // Auto-enroll if not enrolled
            get().enrollCourse(courseId)
          }

          return {
            courses: {
              ...state.courses,
              [courseId]: {
                ...(state.courses[courseId] || {
                  courseId,
                  enrolledAt: Date.now(),
                  completedLessons: [],
                  totalWatchTime: 0,
                  progress: 0,
                }),
                currentLesson: lessonId,
                lastAccessedAt: Date.now(),
              },
            },
          }
        })
      },

      updateWatchTime: (courseId, lessonId, seconds) => {
        set((state) => {
          const course = state.courses[courseId]
          if (!course) return state

          return {
            courses: {
              ...state.courses,
              [courseId]: {
                ...course,
                totalWatchTime: course.totalWatchTime + seconds,
                lastAccessedAt: Date.now(),
              },
            },
          }
        })
      },

      getCourseProgress: (courseId) => {
        return get().courses[courseId] || null
      },

      isLessonCompleted: (courseId, lessonId) => {
        const course = get().courses[courseId]
        return course ? course.completedLessons.includes(lessonId) : false
      },

      calculateProgress: (courseId, totalLessons) => {
        const course = get().courses[courseId]
        if (!course || totalLessons === 0) return 0
        return Math.round((course.completedLessons.length / totalLessons) * 100)
      },
    }),
    {
      name: "course-progress-storage",
    },
  ),
)
