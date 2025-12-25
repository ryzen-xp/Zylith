import { NextRequest, NextResponse } from 'next/server'
import { CONFIG } from '@/lib/config'

/**
 * Proxy route for Starknet RPC calls
 * Forwards RPC requests from frontend to the RPC endpoint
 * This avoids CORS issues by making requests from the server
 */

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body;
    try {
      body = await request.json()
    } catch (e) {
      console.error('Failed to parse request body:', e)
      return NextResponse.json(
        { error: 'Invalid request body' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }
    
    // Get RPC URL from config
    const rpcUrl = CONFIG.STARKNET_RPC || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7'
    
    console.log('Proxying RPC request to:', rpcUrl, 'Body:', JSON.stringify(body).substring(0, 200))
    
    // Forward the RPC request
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    
    console.log('RPC response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return NextResponse.json(
        { error: `RPC error: ${response.status} ${response.statusText}`, details: errorText },
        { 
          status: response.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        }
      )
    }
    
    const data = await response.json()
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error) {
    console.error('RPC proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to connect to RPC endpoint', details: error instanceof Error ? error.message : String(error) },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    )
  }
}

