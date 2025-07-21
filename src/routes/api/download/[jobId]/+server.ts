import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { pb } from "$lib/server/pocketbase";
import { promises as fs } from "fs";
import { createReadStream } from "fs";

export const GET: RequestHandler = async ({ params }) => {
  try {
    const { jobId } = params;

    // Get job from database
    const job = await pb.collection("jobs").getOne(jobId);

    if (!job || job.status !== "completed" || !job.zipPath) {
      throw error(404, "Download not available");
    }

    // Check if zip file exists
    await fs.access(job.zipPath);

    // Get file stats for content-length
    const stats = await fs.stat(job.zipPath);

    // Create read stream
    const stream = createReadStream(job.zipPath);

    // Return file as download
    return new Response(stream as any, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${job.filename.replace(
          ".pptx",
          ""
        )}_analysis.zip"`,
        "Content-Length": stats.size.toString(),
      },
    });
  } catch (err) {
    console.error("Download failed:", err);
    throw error(500, "Download failed");
  }
};
