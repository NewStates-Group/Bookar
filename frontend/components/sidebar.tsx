"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import Image from "next/image"
import Link from "next/link"
import { Bot, CirclePlay, LayoutDashboard, UserCheck } from "lucide-react"

const data = {
    navMain: [
        {
            title: "Visão Geral",
            url: "/app",
            icon: LayoutDashboard
        },
        {
            title: "Cursos",
            url: "/app/courses",
            icon: CirclePlay
        }, {
            title: "Tutor",
            url: "/app",
            icon: UserCheck
        },
        {
            title: "Explicador",
            url: "/app",
            icon: Bot
        },
    ]
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    return (
        <Sidebar collapsible="offcanvas" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            className="data-[slot=sidebar-menu-button]:!p-1.5"
                        >
                            <Link href="/" className="p-6 flex items-center justify-center gap-2 mb-6">
                                <Image src={"/logo.png"} width={40} height={40} alt="Bookar Logo" />
                                <span className="text-3xl font-bold">Bookar</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain} />
            </SidebarContent>
        </Sidebar>
    )
}
