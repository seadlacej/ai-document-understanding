import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { pb } from "$lib/server/pocketbase";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { processJob } from "$lib/server/processor";

const TEMP_UPLOAD_DIR = path.join(process.cwd(), "temp", "uploads");

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Ensure temp directory exists
    await fs.mkdir(TEMP_UPLOAD_DIR, { recursive: true }).catch(() => {});
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file || !file.name.endsWith(".pptx")) {
      return json(
        { error: "Invalid file. Only PPTX files are allowed." },
        { status: 400 }
      );
    }

    // Save file to temp directory
    const fileId = randomUUID();
    const fileName = `${fileId}_${file.name}`;
    const filePath = path.join(TEMP_UPLOAD_DIR, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // Create job in database
    const job = await pb.collection("jobs").create({
      filename: file.name,
      status: "pending",
      uploadedAt: new Date().toISOString(),
    });

    // Create file record
    await pb.collection("files").create({
      jobId: job.id,
      originalName: file.name,
      savedPath: filePath,
      fileSize: file.size,
    });

    // Start processing in background
    processJob(job.id).catch((error) => {
      console.error(`Failed to process job ${job.id}:`, error);
    });

    return json({ jobId: job.id, message: "File uploaded successfully" });
  } catch (error) {
    console.error("Upload failed:", error);
    return json({ error: "Upload failed" }, { status: 500 });
  }
};
