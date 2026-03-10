'use client'

import { useState } from 'react'
import { BookOpen, GraduationCap, User, LogOut, Settings } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function FloatingNavbar() {
    const { data: session } = useSession()
    const [showCursosText, setShowCursosText] = useState(false)
    const [showTutorText, setShowTutorText] = useState(false)

    const user = session?.user as any

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
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border cursor-pointer overflow-hidden bg-muted">
                            {user?.avatar ? (
                                <Avatar className="w-10 h-10">
                                    <AvatarImage src={user.avatar} alt={user.username} />
                                    <AvatarFallback>{user.username?.[0]?.toUpperCase()}</AvatarFallback>
                                </Avatar>
                            ) : (
                                <User className="w-5 h-5 text-muted-foreground" />
                            )}
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>
                            <div className="flex flex-col">
                                <span className="font-semibold">{user?.username}</span>
                                <span className="text-xs text-muted-foreground">{user?.email}</span>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/app/profile" className="cursor-pointer flex items-center gap-2">
                                <User className="w-4 h-4" />
                                <span>Perfil</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/app/settings" className="cursor-pointer flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                <span>Configurações</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="cursor-pointer text-red-500 focus:text-red-500 flex items-center gap-2"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Sair</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </nav>
    )
}
