import PocketBase from "pocketbase";
import { env } from "$env/dynamic/private"; // or use process.env if you prefer
// ^ using SvelteKit's $env/dynamic is often preferred in SvelteKit projects

export const pb = new PocketBase(
  process.env.POCKETBASE_URL ||
    "https://pb-document-analyzer.coolify.create.at/"
);

export interface Job {
  id: string;
  filename: string;
  status: "pending" | "processing" | "completed" | "failed";
  uploadedAt: string;
  completedAt?: string;
  outputPath?: string;
  zipPath?: string;
  error?: string;
  created: string;
  updated: string;
}

export interface FileRecord {
  id: string;
  jobId: string;
  originalName: string;
  savedPath: string;
  fileSize: number;
  created: string;
  updated: string;
}

export async function initPocketBase() {
  try {
    await pb
      .collection("_superusers")
      .authWithPassword(
        env.POCKETBASE_ADMIN_USER || "",
        env.POCKETBASE_ADMIN_PWD || ""
      );
    console.log("Authenticated primary PB as admin");
  } catch (error) {
    console.error("Failed to authenticate primary PB admin:", error);
  }
}
