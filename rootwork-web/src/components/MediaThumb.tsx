import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { type MediaRef } from "../data/people";
import { isImageMedia } from "../media/store";
import { useMediaUrl } from "../media/useMediaUrl";
import { IconDocument, IconMinus, IconPlus } from "../icons";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 6;
const ZOOM_STEP = 0.25;

type View = {
  zoom: number;
  x: number;
  y: number;
};

type Pan = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type MediaThumbProps = {
  media: MediaRef;
  className?: string;
};

export function MediaThumb({ media, className = "" }: MediaThumbProps) {
  const url = useMediaUrl(media);
  if (url && isImageMedia(media)) {
    return <img src={url} alt="" className={`media-thumb ${className}`.trim()} />;
  }
  return (
    <span className={`media-thumb is-file ${className}`.trim()} title={media.originalName}>
      <IconDocument size={14} />
    </span>
  );
}

export type StoryViewerImage = {
  title: string;
  src: string;
  caption?: string;
};

type MediaViewerProps = {
  media?: MediaRef;
  image?: StoryViewerImage;
  onClose: () => void;
  onRemove?: () => void;
  insetMain?: boolean;
};

export function MediaViewer({ media, image, onClose, onRemove, insetMain }: MediaViewerProps) {
  const title = image?.title || media?.originalName || "Image";
  const dialog = (
    <div
      className={`dialog-backdrop stub-dialog media-viewer-backdrop${insetMain ? " is-inset-main" : ""}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="dialog media-viewer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-viewer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-title" id="media-viewer-title">
          {title}
        </div>
        <div className="media-viewer-list">
          {image ? (
            <figure className="media-viewer-item">
              <MediaViewerPane>
                <img src={image.src} alt={image.title} className="media-viewer-image" draggable={false} />
              </MediaViewerPane>
              {image.caption ? <figcaption>{image.caption}</figcaption> : null}
            </figure>
          ) : null}
          {media ? <MediaViewerItem media={media} /> : null}
        </div>
        {!image && !media ? <p className="dialog-body">No file attached yet.</p> : null}
        <div className="dialog-actions">
          {onRemove && (
            <button type="button" className="btn btn-secondary dialog-remove" onClick={onRemove}>
              Remove
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
  if (insetMain) {
    const host = document.querySelector(".app-main");
    if (host) return createPortal(dialog, host);
  }
  return dialog;
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function canvasPoint(canvas: HTMLElement, event: { clientX: number; clientY: number }) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function MediaViewerPane({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<Pan | null>(null);
  const [panning, setPanning] = useState(false);
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;

  function setViewNow(next: View) {
    viewRef.current = next;
    setView(next);
  }

  function zoomTo(nextZoom: number, pivotX: number, pivotY: number) {
    const current = viewRef.current;
    const zoom = clampZoom(nextZoom);
    const worldX = (pivotX - current.x) / current.zoom;
    const worldY = (pivotY - current.y) / current.zoom;
    setViewNow({
      zoom,
      x: pivotX - worldX * zoom,
      y: pivotY - worldY * zoom,
    });
  }

  function zoomBy(delta: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    zoomTo(viewRef.current.zoom + delta, canvas.clientWidth / 2, canvas.clientHeight / 2);
  }

  function resetZoom() {
    setViewNow({ zoom: 1, x: 0, y: 0 });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const host = canvasRef.current;
      if (!host) return;
      const point = canvasPoint(host, event);
      const factor = event.deltaY > 0 ? 1 / 1.1 : 1.1;
      zoomTo(viewRef.current.zoom * factor, point.x, point.y);
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(".tree-zoom")) return;
    event.preventDefault();
    const current = viewRef.current;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: current.x,
      originY: current.y,
    };
    setPanning(true);
    canvasRef.current?.setPointerCapture(event.pointerId);
  }

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const pan = panRef.current;
      if (!pan || event.pointerId !== pan.pointerId) return;
      event.preventDefault();
      setViewNow({
        ...viewRef.current,
        x: pan.originX + (event.clientX - pan.startX),
        y: pan.originY + (event.clientY - pan.startY),
      });
    }
    function onUp(event: PointerEvent) {
      const pan = panRef.current;
      if (!pan || event.pointerId !== pan.pointerId) return;
      panRef.current = null;
      setPanning(false);
      canvasRef.current?.releasePointerCapture(event.pointerId);
    }
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const zoomLabel = `${Math.round(view.zoom * 100)}%`;

  return (
    <div
      ref={canvasRef}
      className={`media-viewer-stage${panning ? " is-dragging" : ""}`}
      onPointerDown={handlePointerDown}
    >
      <div
        className="media-viewer-viewport"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
        }}
      >
        {children}
      </div>
      <div className="tree-zoom">
        <button
          type="button"
          className="btn btn-icon"
          aria-label="Zoom in"
          disabled={view.zoom >= MAX_ZOOM}
          onClick={() => zoomBy(ZOOM_STEP)}
        >
          <IconPlus size={18} />
        </button>
        <button type="button" className="tree-zoom-label" onClick={resetZoom} title="Reset zoom">
          {zoomLabel}
        </button>
        <button
          type="button"
          className="btn btn-icon"
          aria-label="Zoom out"
          disabled={view.zoom <= MIN_ZOOM}
          onClick={() => zoomBy(-ZOOM_STEP)}
        >
          <IconMinus size={18} />
        </button>
      </div>
    </div>
  );
}

function isPdfMedia(media: MediaRef) {
  return media.mime === "application/pdf" || media.ext === "pdf";
}

function MediaViewerItem({ media }: { media: MediaRef }) {
  const url = useMediaUrl(media);
  if (url && isImageMedia(media)) {
    return (
      <figure className="media-viewer-item">
        <MediaViewerPane>
          <img src={url} alt={media.originalName} className="media-viewer-image" draggable={false} />
        </MediaViewerPane>
        <figcaption>{media.originalName}</figcaption>
      </figure>
    );
  }
  if (url && isPdfMedia(media)) {
    return (
      <figure className="media-viewer-item">
        <MediaViewerPane>
          <iframe title={media.originalName} src={url} className="media-viewer-pdf" />
        </MediaViewerPane>
        <figcaption>{media.originalName}</figcaption>
      </figure>
    );
  }
  return (
    <div className="media-viewer-item is-missing">
      <IconDocument size={22} />
      <span>{media.originalName || "File unavailable"}</span>
    </div>
  );
}
