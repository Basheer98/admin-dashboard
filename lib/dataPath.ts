import path from "node:path";

/**
 * Path to the JSON data file. Override with DATA_PATH in production
 * so a persistent volume can be mounted (e.g. DATA_PATH=/data/data.json).
 */
export function getDataPath(): string {
  return process.env.DATA_PATH ?? path.join(process.cwd(), "data.json");
}
