"use client"

import Link from "next/link"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { WalletButton } from "@/components/shared/WalletButton"

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/50 px-6 backdrop-blur-xl">
      <div className="md:hidden">
        {/* Mobile menu trigger - simplified for now */}
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
        </Button>
      </div>
      <div className="w-full flex-1">
        {/* Search or breadcrumbs could go here */}
      </div>
      <div className="flex items-center gap-4">
        <WalletButton />
      </div>
    </header>
  )
}

