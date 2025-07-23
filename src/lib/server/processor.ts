import { pb } from "./pocketbase";
import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import archiver from "archiver";
import { createWriteStream } from "fs";

const execAsync = promisify(exec);

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, "output");

export async function processJob(jobId: string) {
  let job;
  let fileRecord: any;

  try {
    // Ensure directories exist
    await fs.mkdir(OUTPUT_DIR, { recursive: true }).catch(() => {});
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

    // Run the analysis script directly on the file in temp/uploads
    console.log(
      `Starting analysis for job ${jobId}: ${fileRecord.originalName}`
    );

    const scriptPath = path.join(ROOT_DIR, "src", "analyze-pptx.ts");
    const { stdout, stderr } = await execAsync(
      `npx tsx "${scriptPath}" "${fileRecord.savedPath}"`,
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

    // Create zip file in the output directory
    const zipFileName = `${path.basename(
      fileRecord.originalName,
      ".pptx"
    )}.zip`;
    const zipPath = path.join(outputPath, zipFileName);

    await createZip(outputPath, zipPath);

    // Update job with success
    await pb.collection("jobs").update(jobId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      outputPath: outputPath,
      zipPath: zipPath,
    });

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
    
    // Get all files in the directory except the zip file itself
    const zipFileName = path.basename(outputPath);
    archive.glob("**/*", {
      cwd: sourceDir,
      ignore: [zipFileName]
    });
    
    archive.finalize();
  });
}
