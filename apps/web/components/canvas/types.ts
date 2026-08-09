export type CanvasComment = { id: string; body: string; authorName: string; createdAt: string | Date };

export type CanvasPresence = {
  sessionKey: string;
  displayName: string;
  color: string;
  lastSeenAt: string | Date;
};

export type CanvasMarkup = {
  id: string;
  kind: "PIN" | "RECT" | "CLOUD" | "ARROW" | "POLYLINE" | "TEXT" | "MEASURE";
  geometry: any;
  color: string;
  label?: string | null;
  status: "OPEN" | "RESOLVED";
  authorName: string;
  createdAt: string | Date;
  comments: CanvasComment[];
};

export type CanvasSheet = {
  id: string;
  sheetNumber: string;
  title: string;
  revision: string;
  scale?: string | null;
  rasterUrl?: string | null;
  thumbnailUrl?: string | null;
  compareRasterUrl?: string | null;
  compareRevision?: string | null;
  paperWidthMm?: number | null;
  paperHeightMm?: number | null;
  drawingSetName: string;
  projectName: string;
};
