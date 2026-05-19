"use client";

/**
 * Autodesk Platform Services (Forge) Viewer wrapper.
 * Loads viewer3D.min.js from APS CDN, fetches a short-lived viewer token
 * from /api/aps/token, then opens the model by URN.
 */

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    Autodesk: any;
  }
}

const VIEWER_JS = "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js";
const VIEWER_CSS = "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css";

async function loadScriptOnce(src: string) {
  if (document.querySelector(`script[data-src="${src}"]`)) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.dataset.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function loadCssOnce(href: string) {
  if (document.querySelector(`link[data-href="${href}"]`)) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  l.dataset.href = href;
  document.head.appendChild(l);
}

export function ForgeViewer({ urn }: { urn: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let viewer: any;
    let cancelled = false;

    async function init() {
      loadCssOnce(VIEWER_CSS);
      await loadScriptOnce(VIEWER_JS);
      if (cancelled || !ref.current) return;

      const Autodesk = window.Autodesk;
      await new Promise<void>((resolve) => {
        Autodesk.Viewing.Initializer(
          {
            env: "AutodeskProduction2",
            api: "streamingV2",
            getAccessToken: async (
              cb: (token: string, expires: number) => void,
            ) => {
              const r = await fetch("/api/aps/token");
              const { access_token, expires_in } = await r.json();
              cb(access_token, expires_in);
            },
          },
          resolve,
        );
      });

      if (cancelled || !ref.current) return;
      viewer = new Autodesk.Viewing.GuiViewer3D(ref.current);
      viewer.start();

      Autodesk.Viewing.Document.load(
        `urn:${urn}`,
        (doc: any) => {
          const defaultModel = doc.getRoot().getDefaultGeometry();
          viewer.loadDocumentNode(doc, defaultModel);
        },
        (err: any) => {
          console.error("Forge load error:", err);
        },
      );
    }

    init();
    return () => {
      cancelled = true;
      if (viewer) {
        viewer.finish();
        viewer = null;
      }
    };
  }, [urn]);

  return <div ref={ref} className="h-[560px] w-full bg-slate-900" />;
}
