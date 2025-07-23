import { pb } from "./pocketbase";
import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import archiver from "archiver";
import { createWriteStream } from "fs";

const execAsync = promisify(exec);

const ROOT_DIR = process.cwd();
const UPLOADS_DIR = path.join(ROOT_DIR, "uploads");
const OUTPUT_DIR = path.join(ROOT_DIR, "output");
const ZIPS_DIR = path.join(ROOT_DIR, "temp", "zips");

// Ensure directories exist
await fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(() => {});
await fs.mkdir(OUTPUT_DIR, { recursive: true }).catch(() => {});
await fs.mkdir(ZIPS_DIR, { recursive: true }).catch(() => {});

export async function processJob(jobId: string) {
  let job;
  let fileRecord: any;

  try {
    // Update job status to processing
    job = await pb.collection("jobs").update(jobId, {
      status: "processing",
    });

    // Get file record
    const fileRecords = await pb.collection("files").getFullList({
      filter: `jobId = "${jobId}"`,
    });

    if (fileRecords.length === 0) {
      throw new Error("No file found for job");
    }

    fileRecord = fileRecords[0];

    // Copy file to uploads directory
    const uploadPath = path.join(
      UPLOADS_DIR,
      path.basename(fileRecord.originalName)
    );
    await fs.copyFile(fileRecord.savedPath, uploadPath);

    // Run the analysis script
    console.log(
      `Starting analysis for job ${jobId}: ${fileRecord.originalName}`
    );

    const scriptPath = path.join(ROOT_DIR, "src", "analyze-pptx.ts");
    const { stdout, stderr } = await execAsync(
      `npx tsx "${scriptPath}" "${uploadPath}"`,
      {
        cwd: ROOT_DIR,
        env: {
          ...process.env,
          NODE_PATH: path.join(ROOT_DIR, "node_modules"),
        },
      }
    );

    if (stderr) {
      console.error("Analysis stderr:", stderr);
    }

    console.log("Analysis stdout:", stdout);

    // Find the output directory
    const outputDirs = await fs.readdir(OUTPUT_DIR);

    // Transform filename the same way as analyze-pptx.ts does
    const baseFilename = path.basename(fileRecord.originalName, ".pptx");
    const transformedFilename = baseFilename.replace(/\s+/g, "_");

    const jobOutputDir = outputDirs
      .filter((dir) => dir.includes(transformedFilename))
      .sort()
      .pop();

    if (!jobOutputDir) {
      throw new Error("Output directory not found");
    }

    const outputPath = path.join(OUTPUT_DIR, jobOutputDir);

    // Create zip file
    const zipFileName = `${jobId}_${path.basename(
      fileRecord.originalName,
      ".pptx"
    )}.zip`;
    const zipPath = path.join(ZIPS_DIR, zipFileName);

    await createZip(outputPath, zipPath);

    // Update job with success
    await pb.collection("jobs").update(jobId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      outputPath: outputPath,
      zipPath: zipPath,
    });

    // Clean up upload file
    await fs.unlink(uploadPath).catch(() => {});

    console.log(`Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);

    // Update job with failure
    await pb
      .collection("jobs")
      .update(jobId, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
      .catch(console.error);

    // Clean up
    if (fileRecord?.savedPath) {
      const uploadPath = path.join(
        UPLOADS_DIR,
        path.basename(fileRecord.originalName)
      );
      await fs.unlink(uploadPath).catch(() => {});
    }
  }
}

function createZip(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    output.on("close", () => {
      console.log(`Zip created: ${archive.pointer()} bytes`);
      resolve();
    });

    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
