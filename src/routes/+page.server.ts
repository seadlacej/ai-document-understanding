import type { Job } from "$lib/server/pocketbase";

export const load = async (event: any) => {
  try {
    const response = await event.fetch("/api/jobs");
    if (response.ok) {
      const jobs: Job[] = await response.json();
      return {
        jobs,
      };
    }
  } catch (error) {
    console.error("Failed to load jobs:", error);
  }

  return {
    jobs: [],
  };
};
