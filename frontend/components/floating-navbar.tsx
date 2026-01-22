'use client'

import { useState } from 'react'
import { BookOpen, GraduationCap, User, LogOut } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

export function FloatingNavbar() {
    const [showCursosText, setShowCursosText] = useState(false)
    const [showTutorText, setShowTutorText] = useState(false)
    const [showContaText, setShowContaText] = useState(false)

    return (
        <nav className="w-full bg-white border sticky top-0 z-50">
            <div className="flex items-center justify-between h-16 px-6 md:px-8">
                <div className="flex items-center">
                    <Image
                        src="/logo.png"
                        alt="Logo"
                        width={25}
                        height={25}
                        className="w-9 h-9 md:w-10 md:h-10 object-contain"
                        priority
                    />
                    <span className="hidden md:block text-3xl font-bold ml-2">Bookar</span>
                </div>

                <div className="flex items-center gap-4 md:gap-8 flex-1 justify-center">
                    <Link
                        href="/app/courses"
                        className="cursor-pointer flex items-center gap-2 px-2 md:px-3 py-2 transition-all duration-300 hover:bg-cyan-300/10 group"
                        onMouseEnter={() => setShowCursosText(true)}
                        onMouseLeave={() => setShowCursosText(false)}
                    >
                        <BookOpen
                            className="w-7 h-7 pl-1 group-hover:text-cyan-300 transition-colors" />
                        <span
                            className={`m-0 text-lg font-medium whitespace-nowrap transition-all duration-300 overflow-hidden ${showCursosText ? 'w-16 opacity-100' : 'w-0 opacity-0'
                                }`}
                        >
                            Cursos
                        </span>
                    </Link>

                    <Link
                        href="/app/tutor"
                        className="cursor-pointer flex items-center gap-2 px-2 md:px-3 py-2 transition-all duration-300 hover:bg-cyan-300/10 group"
                        onMouseEnter={() => setShowTutorText(true)}
                        onMouseLeave={() => setShowTutorText(false)}
                    >
                        <GraduationCap
                            className="w-7 h-7 pl-1 group-hover:text-cyan-300 transition-colors" />
                        <span
                            className={`m-0 text-lg font-medium whitespace-nowrap transition-all duration-300 overflow-hidden ${showTutorText ? 'w-12 opacity-100' : 'w-0 opacity-0'
                                }`}
                        >
                            Tutor
                        </span>
                    </Link>
                </div>

                <button className="flex items-center justify-center w-10 h-10 rounded-full border cursor-pointer">
                    <User className="w-5 h-5  group-hover:text-cyan-300 transition-colors" />
                </button>
            </div>
        </nav>
    )
}
