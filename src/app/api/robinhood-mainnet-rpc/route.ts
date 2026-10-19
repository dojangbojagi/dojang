import { createMainnetRpcProxyHandler } from "@/lib/server/robinhood-mainnet-rpc-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const handleRequest = createMainnetRpcProxyHandler();

export async function POST(request: Request): Promise<Response> {
  return handleRequest(request);
}
