import { NextRequest, NextResponse } from 'next/server'
import { CONFIG } from '@/lib/config'

/**
 * Proxy route for ASP (Association Set Provider) server
 * Forwards all requests to the ASP server running on localhost:3000
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug: slugArray } = await params
    const slug = slugArray || []
    const path = slug.join('/')
    
    // Build URL to ASP server
    const aspUrl = CONFIG.ASP_SERVER_URL || 'http://localhost:3000'
    const url = `${aspUrl}/${path}`
    
    // Forward query parameters
    const searchParams = request.nextUrl.searchParams.toString()
    const fullUrl = searchParams ? `${url}?${searchParams}` : url
    
    // Forward request to ASP server
    console.log(`[Proxy] Forwarding GET request to ASP: ${fullUrl}`);
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    console.log(`[Proxy] ASP response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`[Proxy] ASP error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: `ASP server error: ${response.status} ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    console.log(`[Proxy] ✅ Successfully forwarded response from ASP`);
    return NextResponse.json(data)
  } catch (error) {
    console.error('ASP proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to ASP server', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug: slugArray } = await params
    const slug = slugArray || []
    const path = slug.join('/')
    
    // Build URL to ASP server
    const aspUrl = CONFIG.ASP_SERVER_URL || 'http://localhost:3000'
    const url = `${aspUrl}/${path}`
    
    // Get request body
    const body = await request.json().catch(() => ({}))
    
    // Forward request to ASP server
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return NextResponse.json(
        { error: `ASP server error: ${response.status} ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('ASP proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to ASP server', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

