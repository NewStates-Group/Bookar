'use client'

import { useState } from 'react'
import { BookOpen, GraduationCap, User, LogOut, Settings } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { signOut, useSession } from "next-auth/react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"

export function FloatingNavbar() {
    const { data: session } = useSession()
    const [showCursosText, setShowCursosText] = useState(false)
    const [showTutorText, setShowTutorText] = useState(false)

    const userInitials = session?.user?.username?.slice(0, 2).toUpperCase() || 'U'
    const avatarUrl = session?.user?.avatar ? `${process.env.NEXT_PUBLIC_API_URL}${session.user.avatar}` : ""

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

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center justify-center w-10 h-10 rounded-full border cursor-pointer hover:bg-muted/50 transition-colors overflow-hidden">
                            <Avatar className="h-full w-full">
                                <AvatarImage src={avatarUrl} alt={session?.user?.username || 'User'} />
                                <AvatarFallback className="bg-cyan-500/10 text-cyan-700 font-medium">
                                    {userInitials}
                                </AvatarFallback>
                            </Avatar>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 mt-2">
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{session?.user?.username}</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {session?.user?.email}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/app/profile" className="flex items-center cursor-pointer">
                                <User className="mr-2 h-4 w-4" />
                                <span>Perfil</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="flex items-center cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={() => signOut({ callbackUrl: '/login' })}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Sair</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </nav>
    )
}
