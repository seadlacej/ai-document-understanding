import { initPocketBase, pb } from "$lib/server/pocketbase";
import type { Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";

await initPocketBase();
// Disable auto cancellation
pb.autoCancellation(false);

export const handlePb: Handle = async ({ event, resolve }) => {
  event.locals.pb = pb;
  try {
    // get an up-to-date auth store state by verifying and refreshing the loaded auth model (if any)
    event.locals.pb.authStore.isValid &&
      (await event.locals.pb.collection("_superusers").authRefresh());
  } catch (error: any) {
    console.error("Pocketbase authStore not valid! ", error.message);
    event.locals.pb.authStore.clear();
  }

  const response = await resolve(event);

  response.headers.append(
    "set-cookie",
    event.locals.pb.authStore.exportToCookie({ httpOnly: false })
  );

  return response;
};

export const handle = sequence(handlePb);
