'use client'

import { useState } from 'react'
import { BookOpen, GraduationCap, User, LogOut, Settings, Network, Bot } from 'lucide-react'
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
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Sparkles } from 'lucide-react'

export function FloatingNavbar() {
    const { data: session } = useSession()
    const [showCursosText, setShowCursosText] = useState(false)
    const [showMindMapsText, setShowMindMapsText] = useState(false)
    const [showExplicadorText, setShowExplicadorText] = useState(false)
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
                        href="/app/mind-maps"
                        className="cursor-pointer flex items-center gap-2 px-2 md:px-3 py-2 transition-all duration-300 hover:bg-cyan-300/10 group"
                        onMouseEnter={() => setShowMindMapsText(true)}
                        onMouseLeave={() => setShowMindMapsText(false)}
                    >
                        <Network
                            className="w-7 h-7 pl-1 group-hover:text-cyan-300 transition-colors" />
                        <span
                            className={`m-0 text-lg font-medium whitespace-nowrap transition-all duration-300 overflow-hidden ${showMindMapsText ? 'w-32 opacity-100' : 'w-0 opacity-0'
                                }`}
                        >
                            Mapas Mentais
                        </span>
                    </Link>

                    <Link
                        href="/app/explicador"
                        className="cursor-pointer flex items-center gap-2 px-2 md:px-3 py-2 transition-all duration-300 hover:bg-cyan-300/10 group"
                        onMouseEnter={() => setShowExplicadorText(true)}
                        onMouseLeave={() => setShowExplicadorText(false)}
                    >
                        <Bot
                            className="w-7 h-7 pl-1 group-hover:text-cyan-300 transition-colors" />
                        <span
                            className={`m-0 text-lg font-medium whitespace-nowrap transition-all duration-300 overflow-hidden ${showExplicadorText ? 'w-24 opacity-100' : 'w-0 opacity-0'
                                }`}
                        >
                            Explicador
                        </span>
                    </Link>

                    <Dialog>
                        <DialogTrigger asChild>
                            <div
                                className="cursor-pointer flex items-center gap-2 px-2 md:px-3 py-2 transition-all duration-300 hover:bg-cyan-300/10 group relative"
                                onMouseEnter={() => setShowTutorText(true)}
                                onMouseLeave={() => setShowTutorText(false)}
                            >
                                <GraduationCap
                                    className="w-7 h-7 pl-1 group-hover:text-cyan-300 transition-colors" />
                                <span
                                    className={`m-0 text-lg font-medium whitespace-nowrap transition-all duration-300 overflow-hidden flex items-center gap-1 ${showTutorText ? 'w-24 opacity-100' : 'w-0 opacity-0'
                                        }`}
                                >
                                    Tutor
                                    <Badge variant="secondary" className="text-[10px] px-1 py-0 leading-tight">Breve</Badge>
                                </span>
                            </div>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] border-cyan-300/20 bg-white/80 backdrop-blur-xl shadow-2xl">
                            <DialogHeader>
                                <DialogTitle className="flex items-center text-center justify-center gap-2 text-2xl font-bold text-gray-800">
                                    <GraduationCap className="w-8 h-8 animate-pulse" />
                                    Tutor em Breve!
                                </DialogTitle>
                                <DialogDescription className="text-base text-center pt-4 text-gray-600 leading-relaxed">
                                    Estamos a trabalhar arduamente para trazer o seu assistente pessoal de aprendizagem.
                                    <span className="text-sm font-medium text-cyan-600 text-center">
                                        &nbsp;A sua jornada de aprendizagem está prestes a ficar mais inteligente.
                                    </span>
                                </DialogDescription>
                            </DialogHeader>
                        </DialogContent>
                    </Dialog>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border cursor-pointer overflow-hidden bg-muted">
                            {user?.avatar ? (
                                <Avatar className="w-10 h-10">
                                    <AvatarImage src={user.avatar.startsWith('http') ? user.avatar : `${process.env.NEXT_PUBLIC_API_URL}${user.avatar}`} alt={user.first_name || user.email} />
                                    <AvatarFallback>{(user.first_name || user.email || "U")[0]?.toUpperCase()}</AvatarFallback>
                                </Avatar>
                            ) : (
                                <User className="w-5 h-5 text-muted-foreground" />
                            )}
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>
                            <div className="flex flex-col">
                                <span className="font-semibold">{user?.first_name ? `${user.first_name} ${user.last_name || ""}` : user?.email}</span>
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
                        {/* <DropdownMenuItem asChild>
                            <Link href="/app/settings" className="cursor-pointer flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                <span>Configurações</span>
                            </Link>
                        </DropdownMenuItem> */}
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
