"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    Menu,
    X,
    LogOut,
    User,
    LayoutDashboard,
    Activity,
    FileEdit,
} from "lucide-react"
import { useAuthStore } from "@/lib/auth"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { useState } from "react"

const navLinks = [
    { href: "/diagnostic", label: "Diagnostic", icon: Activity },
    { href: "/expert", label: "Expert Review", icon: FileEdit },
    { href: "/admin", label: "Admin", icon: LayoutDashboard },
]

export function Navbar() {
    const { user, isAuthenticated, logout } = useAuthStore()
    const [isOpen, setIsOpen] = useState(false)
    const pathname = usePathname()
    const { setTheme, theme } = useTheme()
    const router = useRouter()

    const handleLogout = () => {
        logout()
        setIsOpen(false)
        router.push("/login")
    }

    return (
        <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 items-center justify-between">
                {/* Logo */}
                <Link href="/" className="mr-6 flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
                        D
                    </div>
                    <span className="hidden font-bold sm:inline-block">
                        Dental IOTN AI
                    </span>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden md:flex md:items-center md:space-x-6">
                    {isAuthenticated ? (
                        <>
                            {navLinks.map((link) => {
                                if (link.href === "/expert" && user?.role !== "expert" && user?.role !== "admin") return null
                                if (link.href === "/admin" && user?.role !== "admin") return null

                                const Icon = link.icon
                                const isActive = pathname === link.href
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`flex items-center space-x-2 text-sm font-medium transition-colors hover:text-primary ${isActive ? "text-primary" : "text-muted-foreground"
                                            }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        <span>{link.label}</span>
                                    </Link>
                                )
                            })}
                        </>
                    ) : null}
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    >
                        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                        <span className="sr-only">Toggle theme</span>
                    </Button>

                    {isAuthenticated ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src="" alt={user?.email} />
                                        <AvatarFallback>{user?.email?.[0].toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">{user?.email}</p>
                                        <p className="text-xs leading-none text-muted-foreground">
                                            {user?.role}
                                        </p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Log out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Button variant="default" asChild>
                            <Link href="/login">Sign In</Link>
                        </Button>
                    )}

                    {/* Mobile Menu Button */}
                    <Button
                        variant="ghost"
                        className="md:hidden"
                        size="icon"
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        {isOpen ? <X /> : <Menu />}
                    </Button>
                </div>
            </div>

            {/* Mobile Nav */}
            {isOpen && (
                <div className="border-t md:hidden">
                    <div className="container grid gap-1 p-4">
                        {isAuthenticated ? (
                            navLinks.map((link) => {
                                if (link.href === "/expert" && user?.role !== "expert" && user?.role !== "admin") return null
                                if (link.href === "/admin" && user?.role !== "admin") return null

                                const Icon = link.icon
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setIsOpen(false)}
                                        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                                    >
                                        <Icon className="h-4 w-4" />
                                        {link.label}
                                    </Link>
                                )
                            })
                        ) : (
                            <Link href="/login" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">
                                <User className="h-4 w-4" />
                                Sign In
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </nav>
    )
}