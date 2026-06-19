"use client"


import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"
import { Crown, LogOut, BarChart3 } from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"

export function NavUser() {
    const { data: session, status } = useSession();
    const { isMobile } = useSidebar()

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <Avatar className="h-8 w-8 rounded-lg grayscale">
                                <AvatarImage src={session?.user?.avatar ? (session.user.avatar.startsWith('http') ? session.user.avatar : `${process.env.NEXT_PUBLIC_API_URL}${session.user.avatar}`) : ""} alt={session?.user?.first_name || session?.user?.email} />
                                <AvatarFallback className="rounded-lg">{(session?.user?.first_name || session?.user?.email || "U").slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">{session?.user?.first_name ? `${session.user.first_name} ${session.user.last_name || ""}` : session?.user?.email}</span>
                                <span className="text-muted-foreground truncate text-xs">
                                    {session?.user?.email}
                                </span>
                            </div>
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                        side={isMobile ? "bottom" : "right"}
                        align="end"
                        sideOffset={4}
                    >
                        <DropdownMenuLabel className="p-0 font-normal">
                            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                <Avatar className="h-8 w-8 rounded-lg">
                                    <AvatarImage src={session?.user?.avatar ? (session.user.avatar.startsWith('http') ? session.user.avatar : `${process.env.NEXT_PUBLIC_API_URL}${session.user.avatar}`) : ""} alt={session?.user?.first_name || session?.user?.email} />
                                    <AvatarFallback className="rounded-lg">{(session?.user?.first_name || session?.user?.email || "U").slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-medium">{session?.user?.first_name ? `${session.user.first_name} ${session.user.last_name || ""}` : session?.user?.email}</span>
                                    <span className="text-muted-foreground truncate text-xs">
                                        {session?.user?.email}
                                    </span>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem asChild>
                                <Link href="/app/profile" className="cursor-pointer">
                                    Conta
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <Link href="/app/subscription" className="cursor-pointer">
                                    <Crown className="w-4 h-4 text-muted-foreground mr-2" />
                                    Subscrição
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                Notificações
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => {
                            signOut({ callbackUrl: '/login' })
                        }} className="cursor-pointer text-error text-red-500 focus:text-red-500">
                            <span>Sair</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
