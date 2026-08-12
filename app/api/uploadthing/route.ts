import { createRouteHandler } from "uploadthing/next";
import { passFileRouter } from "./core";

/**
 * UploadThing's presign + callback endpoint. Reads `UPLOADTHING_TOKEN` from the
 * environment on its own — there is no config to pass.
 */
export const { GET, POST } = createRouteHandler({ router: passFileRouter });
