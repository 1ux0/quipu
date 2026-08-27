import { ASSETS_STORAGE_MARKER as STORAGE_MARKER } from "./config";

export function toDisplay(markdown: string, assetUrlPrefix: string): string {
  return markdown.split(STORAGE_MARKER).join(`](${assetUrlPrefix}`);
}

export function toStorage(markdown: string, assetUrlPrefix: string): string {
  return markdown.split(`](${assetUrlPrefix}`).join(STORAGE_MARKER);
}
