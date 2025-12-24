import { NextRequest, NextResponse } from "next/server";
import { CONFIG } from "@/lib/config";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  // #region agent log
  fetch('http://127.0.0.1:7246/ingest/e1dd4cf6-226a-4b8e-92cd-9b8cf5fee932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:GET:entry',message:'Merkle API route called',data:{aspUrl:CONFIG.ASP_SERVER_URL},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  
  const { slug } = await params;
  const slugPath = slug.join("/");
  const url = `${CONFIG.ASP_SERVER_URL}/${slugPath}`;
  
  // #region agent log
  fetch('http://127.0.0.1:7246/ingest/e1dd4cf6-226a-4b8e-92cd-9b8cf5fee932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:GET:before-fetch',message:'About to fetch ASP',data:{url,slugPath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  try {
    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/e1dd4cf6-226a-4b8e-92cd-9b8cf5fee932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:GET:fetch-start',message:'Fetch started',data:{url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    const response = await fetch(url);
    
    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/e1dd4cf6-226a-4b8e-92cd-9b8cf5fee932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:GET:fetch-response',message:'Fetch response received',data:{ok:response.ok,status:response.status,statusText:response.statusText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    if (!response.ok) {
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/e1dd4cf6-226a-4b8e-92cd-9b8cf5fee932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:GET:response-not-ok',message:'Response not OK',data:{status:response.status,statusText:response.statusText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { error: `ASP Error: ${response.statusText}` },
        { status: response.status }
      );
    }
    const data = await response.json();
    
    // Add caching headers
    const headers = new Headers();
    headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
    
    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/e1dd4cf6-226a-4b8e-92cd-9b8cf5fee932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:GET:success',message:'Request successful',data:{hasData:!!data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    return NextResponse.json(data, { headers });
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/e1dd4cf6-226a-4b8e-92cd-9b8cf5fee932',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:GET:catch',message:'Fetch error caught',data:{errorName:error?.constructor?.name,errorMessage:error instanceof Error ? error.message : String(error),url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return NextResponse.json(
      { error: "Failed to fetch from ASP" },
      { status: 500 }
    );
  }
}

