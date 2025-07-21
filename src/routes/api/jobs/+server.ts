import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { pb } from "$lib/server/pocketbase";

export const GET: RequestHandler = async () => {
  try {
    const jobs = await pb.collection("jobs").getFullList({
      sort: "-created",
    });

    return json(jobs);
  } catch (error) {
    console.error("Failed to fetch jobs:", error);
    return json([], { status: 500 });
  }
};
