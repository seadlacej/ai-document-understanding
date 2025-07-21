import type { Job } from "$lib/server/pocketbase";
import dotenv from "dotenv";
dotenv.config();

export const load = async (event: any) => {
  try {
    const response = await event.fetch("/api/jobs");
    if (response.ok) {
      const jobs: Job[] = await response.json();
      return {
        jobs,
        pocketbaseUrl: process.env.POCKETBASE_URL,
      };
    }
  } catch (error) {
    console.error("Failed to load jobs:", error);
  }

  return {
    jobs: [],
  };
};
