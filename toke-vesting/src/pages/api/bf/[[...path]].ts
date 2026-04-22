// Next.js API route - BlockFrost generic proxy
// Forwards all requests to BlockFrost API with authentication

import type { NextApiRequest, NextApiResponse } from "next";

type ErrorResponse = {
  error: string;
  message?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ErrorResponse | unknown>
) {
  // Only allow GET and POST methods (BlockFrost supports these)
  if (!["GET", "POST"].includes(req.method || "")) {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // Extract the path from the URL
    // The path will be in req.query.path as an array from the [...path] catch-all
    const { path } = req.query;
    const pathString = Array.isArray(path) ? path.join("/") : path || "";

    // Build the BlockFrost URL
    const blockfrostBaseUrl = "https://cardano-mainnet.blockfrost.io/api/v0";
    const targetUrl = `${blockfrostBaseUrl}/${pathString}`;

    // Log the request (for debugging)
    console.log(`[BlockFrost Proxy] ${req.method} ${pathString}`);

    // Prepare headers - use the real API key from environment
    const headers: Record<string, string> = {
      "project_id": process.env.BF_API || "",
      "Content-Type": "application/json",
    };

    // If there are additional headers from the client, we might want to forward some
    // But we explicitly do NOT forward any authorization headers from the client
    // to prevent the fake key from being sent to BlockFrost

    // Prepare the fetch options
    const fetchOptions: RequestInit = {
      method: req.method,
      headers,
    };

    // Forward the body for POST requests
    if (req.method === "POST" && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    // Make the request to BlockFrost
    const response = await fetch(targetUrl, fetchOptions);

    // Get the response data
    const data = await response.json();

    // Log response status for debugging
    if (!response.ok) {
      console.error(`[BlockFrost Proxy] Error ${response.status}:`, data);
    }

    // Forward the status code and data
    res.status(response.status).json(data);
  } catch (error) {
    console.error("[BlockFrost Proxy] Error:", error);
    res.status(500).json({
      error: "Proxy Error",
      message: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

// Disable body parsing to handle raw requests
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};
