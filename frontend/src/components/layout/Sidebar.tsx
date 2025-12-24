"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, ArrowLeftRight, Droplets, Wallet, History, FileText, Zap } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const sidebarItems = [
  {
    title: "Overview",
    href: "/",
    icon: Home,
  },
  {
    title: "Swap",
    href: "/swap",
    icon: ArrowLeftRight,
  },
  {
    title: "Liquidity",
    href: "/liquidity",
    icon: Droplets,
  },
  {
    title: "Portfolio",
    href: "/portfolio",
    icon: Wallet,
  },
  {
    title: "History",
    href: "/history",
    icon: History,
  },
  {
    title: "Demo",
    href: "/demo",
    icon: Zap,
  },
  {
    title: "Docs",
    href: "/docs",
    icon: FileText,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="hidden border-r bg-card/50 lg:block dark:bg-stark-darker/50 w-64 flex-col">
      <div className="flex h-16 items-center px-6 border-b border-border/50">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-stark-blue">
          <Zap className="h-6 w-6" />
          <span>Zylith</span>
        </Link>
      </div>
      <div className="flex-1 py-6">
        <nav className="grid items-start px-4 text-sm font-medium gap-2">
          {sidebarItems.map((item, index) => (
            <Link
              key={index}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-stark-blue",
                pathname === item.href
                  ? "bg-stark-blue/10 text-stark-blue"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          ))}
        </nav>
      </div>
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Sepolia Network
        </div>
      </div>
    </div>
  )
}

