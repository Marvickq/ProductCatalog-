import { Cursor } from "../types";

export function encodeCursor(cursor: Cursor): string {
  const json = JSON.stringify(cursor);
  return Buffer.from(json, "utf-8").toString("base64url");
}

export function decodeCursor(encoded: string): Cursor {
  const json = Buffer.from(encoded, "base64url").toString("utf-8");
  return JSON.parse(json) as Cursor;
}
