export const isBrowser =
  typeof window !== "undefined" && typeof window.document !== "undefined";

export * from "./selectors";
export * from "./vgmdb";
