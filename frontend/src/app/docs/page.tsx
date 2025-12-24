"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, Code, Book, Link as LinkIcon, Zap } from "lucide-react"
import Link from "next/link"

const DOC_SECTIONS = [
  {
    title: "Getting Started",
    items: [
      { title: "Introduction", href: "#", icon: Book },
      { title: "Quick Start", href: "#", icon: Zap },
      { title: "Installation", href: "#", icon: Code },
    ]
  },
  {
    title: "Architecture",
    items: [
      { title: "System Overview", href: "#", icon: FileText },
      { title: "CLMM Layer", href: "#", icon: FileText },
      { title: "Privacy Layer", href: "#", icon: FileText },
    ]
  },
  {
    title: "Integration",
    items: [
      { title: "Frontend Guide", href: "#", icon: Code },
      { title: "Backend API", href: "#", icon: Code },
      { title: "Contract ABI", href: "#", icon: Code },
    ]
  },
  {
    title: "Resources",
    items: [
      { title: "GitHub Repository", href: "https://github.com/KevinMB0220/starknet-bounty", icon: LinkIcon },
      { title: "API Reference", href: "#", icon: FileText },
      { title: "Security", href: "#", icon: FileText },
    ]
  }
]

export default function DocsPage() {
  const [selectedSection, setSelectedSection] = useState<string | null>(null)

  return (
    <div className="container py-10">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-6">
              <div>
                <h2 className="text-lg font-bold mb-4">Documentation</h2>
                <nav className="space-y-2">
                  {DOC_SECTIONS.map((section) => (
                    <div key={section.title} className="space-y-1">
                      <button
                        onClick={() => setSelectedSection(
                          selectedSection === section.title ? null : section.title
                        )}
                        className="text-sm font-medium text-muted-foreground hover:text-white w-full text-left"
                      >
                        {section.title}
                      </button>
                      {(selectedSection === section.title || !selectedSection) && (
                        <div className="ml-4 space-y-1">
                          {section.items.map((item) => (
                            <Link
                              key={item.title}
                              href={item.href}
                              className="flex items-center gap-2 text-sm text-stark-gray hover:text-stark-blue py-1"
                            >
                              <item.icon className="h-3 w-3" />
                              {item.title}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </nav>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <Card className="bg-stark-dark border-stark-gray/10">
              <CardContent className="p-8">
                <h1 className="text-3xl font-bold mb-6">Documentation</h1>
                <div className="prose prose-invert max-w-none space-y-6">
                  <p className="text-stark-gray">
                    Welcome to the Zylith documentation. Here you'll find everything you need to 
                    integrate and use the Zylith private AMM protocol.
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-4 mt-8">
                    <Link href="/docs/getting-started">
                      <Card className="bg-stark-darker border-stark-gray/10 hover:border-stark-blue/30 transition-colors cursor-pointer">
                        <CardContent className="p-6">
                          <h3 className="font-bold mb-2">Getting Started</h3>
                          <p className="text-sm text-muted-foreground">
                            Learn the basics and start building with Zylith
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                    <Link href="/docs/architecture">
                      <Card className="bg-stark-darker border-stark-gray/10 hover:border-stark-blue/30 transition-colors cursor-pointer">
                        <CardContent className="p-6">
                          <h3 className="font-bold mb-2">Architecture</h3>
                          <p className="text-sm text-muted-foreground">
                            Understand how Zylith works under the hood
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

