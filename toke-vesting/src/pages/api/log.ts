// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
// pages/api/log.ts
import type { NextApiRequest, NextApiResponse } from "next";

type LogRequestBody = {
  messages: string[];
};

type ResponseData = {
  success: boolean;
  message?: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
) {
  if (req.method === "POST") {
    try {
      const { messages } = req.body as LogRequestBody;

      if (!Array.isArray(messages)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid payload. 'messages' must be an array." });
      }

      // Log each message
      messages.forEach((message, index) => {
        console.log(`[Log ${index + 1}]:`, message);
      });

      return res.status(200).json({ success: true, message: "Logs recorded successfully." });
    } catch (error) {
      console.error("Error logging messages:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to process the request." });
    }
  } else {
    // Handle unsupported HTTP methods
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }
}