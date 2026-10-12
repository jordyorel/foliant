"use client";

import {type ChangeEvent, type CSSProperties, type DragEvent, type PointerEvent, type ReactNode, memo, useEffect, useMemo, useRef, useState} from "react";
import type {PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask} from "pdfjs-dist";
import {movePageInOrder} from "@/lib/studio/page-order";
import {pdfPixelRatio} from "@/lib/studio/raster-budget";
import {pdfRenderQueue} from "@/lib/studio/render-queue";

export type StudioPageAction = "delete" | "extract" | "reorder" | "rotate";
export type StudioEditorTool = "form" | "hand" | "select" | "signature" | "text";

export type StudioPdfAnnotation = {
  bold?: boolean;
  fontFamily?: "mono" | "sans" | "serif";
  fontSize?: number;
  height: number;
  id: string;
  page: number;
  rotation?: number;
  text: string;
  textAlign?: "center" | "left" | "right";
  textColor?: string;
  signatureStrokes?: Array<Array<{x: number; y: number}>>;
  signatureColor?: string;
  signatureImage?: string;
  signatureStyle?: "elegant" | "plain" | "script";
  type: "signature" | "text";
  width: number;
  x: number;
  y: number;
};

export type StudioPendingSignature = Pick<StudioPdfAnnotation, "height" | "signatureColor" | "signatureImage" | "signatureStrokes" | "signatureStyle" | "text" | "type" | "width">;

export type StudioPdfFormField = {
  maxLength?: number;
  name: string;
  options?: string[];
  type: "checkbox" | "radio" | "select" | "text";
  value: boolean | string;
};

export type StudioWatermarkPreview = {
  color: string;
  fontSize: number;
  opacity: number;
  position: "center" | "diagonal" | "repeated";
  text: string;
};

export type StudioPageNumberPreview = {
  color: string;
  fontSize: number;
  format: "number" | "page" | "page_of_total";
  margin: number;
  position: "bottom_left" | "bottom_center" | "bottom_right" | "top_left" | "top_center" | "top_right";
  startNumber: number;
  startPage: number;
};

type StudioPageActionState = {
  action: StudioPageAction;
  page: number;
};

type StudioPdfViewerLabels = {
  removeAnnotation: string;
  addFile: string;
  comingSoon: string;
  hideThumbnails: string;
  hideResultPanel: string;
  loading: string;
  preview: string;
  resultPanel: string;
  showThumbnails: string;
  showResultPanel: string;
  thumbnails: string;
  unavailableText: string;
  unavailableTitle: string;
  pageActions: {
    cannotDeleteLastPage: string;
    clearSelection: string;
    delete: string;
    deleteSelection: string;
    error: string;
    extract: string;
    extractSelection: string;
    rotate: string;
    select: string;
    selected: string;
  };
};

type StudioPdfViewerProps = {
  actionLabel: string;
  activeTool?: StudioEditorTool;
  annotations?: StudioPdfAnnotation[];
  defaultSidePanelOpen?: boolean;
  fallbackPageCount: number;
  formFields?: StudioPdfFormField[];
  labels: StudioPdfViewerLabels;
  name: string;
  onAnnotationChange?: (annotationId: string, patch: Partial<Pick<StudioPdfAnnotation, "bold" | "fontFamily" | "fontSize" | "height" | "rotation" | "text" | "textAlign" | "textColor" | "width" | "x" | "y">>) => void;
  onAnnotationDelete?: (annotationId: string) => void;
  onAnnotationEditEnd?: (annotationId: string) => void;
  onAnnotationEditStart?: (annotationId: string) => void;
  onAnnotationSelect?: (annotationId: string | null) => void;
  onInsertPages?: (afterPage: number) => void;
  onFormFieldChange?: (name: string, value: boolean | string) => void;
  onPlaceAnnotation?: (input: {page: number; x: number; y: number}) => void;
  onPageAction?: (action: StudioPageAction, page: number) => void;
  onBulkPageAction?: (action: "delete" | "extract", pages: number[]) => void;
  onPageCountChange?: (pageCount: number) => void;
  onReorderPages?: (pageOrder: number[]) => void;
  pageOrder?: number[];
  pageRotations?: Record<number, number>;
  pendingSignature?: StudioPendingSignature | null;
  selectedAnnotationId?: string | null;
  pageActionError?: string;
  pageActionState?: StudioPageActionState | null;
  previewUrl?: string;
  pageNumberPreview?: StudioPageNumberPreview | null;
  sidePanel?: ReactNode;
  watermarkPreview?: StudioWatermarkPreview | null;
};

type PdfState = "idle" | "loading" | "ready" | "error";
type AnnotationTransformMode = "move" | "resize" | "resizeHeight" | "resizeWidth" | "rotate";
type AnnotationTransform = {
  annotationId: string;
  centerClientX: number;
  centerClientY: number;
  mode: AnnotationTransformMode;
  pageHeight: number;
  pageWidth: number;
  startClientX: number;
  startClientY: number;
  startPointerAngle: number;
  startRotation: number;
  startHeight: number;
  startWidth: number;
  startX: number;
  startY: number;
};

type PositionedFormWidget = {
  height: number;
  name: string;
  page: number;
  width: number;
  x: number;
  y: number;
};

const workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
const minZoom = 0.1;
const maxZoom = 10;
const initialZoom = 1;

type PageSize = {
  height: number;
  width: number;
};

function clampZoom(value: number) {
  return Math.min(maxZoom, Math.max(minZoom, Number(value.toFixed(2))));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function zoomStep(current: number) {
  if (current < 1) return 0.1;
  if (current < 3) return 0.25;
  if (current < 5) return 0.5;

  return 1;
}

function nextZoom(current: number, direction: "in" | "out") {
  const step = zoomStep(current);
  return clampZoom(direction === "in" ? current + step : current - step);
}

function pageNumbers(count: number, limit?: number) {
  const pageCount = Math.max(1, count);
  const visibleCount = limit ? Math.min(pageCount, limit) : pageCount;

  return Array.from({length: visibleCount}, (_, index) => index + 1);
}

function pageActionLabel(label: string, page: number) {
  return `${label} ${page}`;
}

const PdfCanvas = memo(function PdfCanvas({className, pageNumber, pdf, rotation = 0, scale}: {
  className: string;
  pageNumber: number;
  pdf: PDFDocumentProxy;
  rotation?: number;
  scale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const renderedRef = useRef<{pdf: PDFDocumentProxy; pageNumber: number; scale: number} | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }
    const root = canvas.closest(".studio-editor-canvas, .studio-editor-thumbnails");
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), {
      root,
      rootMargin: "200px"
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    const controller = new AbortController();

    async function renderPage() {
      const page = await pdf.getPage(pageNumber);

      if (cancelled) {
        return;
      }

      const viewport = page.getViewport({scale});
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      // Reserve the page layout, but rasterize only visible/nearby canvases.
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
      if (!isVisible) return;
      const rendered = renderedRef.current;
      if (rendered?.pdf === pdf && rendered.pageNumber === pageNumber && rendered.scale === scale) return;

      const context = canvas.getContext("2d", {alpha: false});

      if (!context) {
        return;
      }

      // Bound raster memory independently of zoom and high-density displays.
      const pixelRatio = pdfPixelRatio(viewport.width, viewport.height, window.devicePixelRatio || 1);

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      renderedRef.current = null;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.fillStyle = "#fff";
      context.fillRect(0, 0, viewport.width, viewport.height);

      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport
      });

      await renderTask.promise;
      if (!cancelled) renderedRef.current = {pdf, pageNumber, scale};
    }

    const canvas = canvasRef.current;
    const render = isVisible && canvas
      ? pdfRenderQueue.run(renderPage, canvas, controller.signal, className.includes("thumb") ? 1 : 0)
      : renderPage();
    render.catch((error: unknown) => {
      if (!cancelled && error instanceof Error && error.name !== "RenderingCancelledException") {
        console.error(error);
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
      renderTask?.cancel();
    };
  }, [className, isVisible, pageNumber, pdf, scale]);

  useEffect(() => {
    if (isVisible) return;
    const timer = window.setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = 1;
      canvas.height = 1;
      renderedRef.current = null;
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [isVisible]);

  return (
    <canvas
      className={className}
      data-rotation={rotation || undefined}
      ref={canvasRef}
      style={rotation ? {transform: `rotate(${rotation}deg)`} : undefined}
    />
  );
});

export function StudioPdfViewer({
  actionLabel,
  activeTool = "select",
  annotations = [],
  defaultSidePanelOpen = false,
  fallbackPageCount,
  formFields = [],
  labels,
  name,
  onAnnotationChange,
  onAnnotationDelete,
  onAnnotationEditEnd,
  onAnnotationEditStart,
  onAnnotationSelect,
  onInsertPages,
  onFormFieldChange,
  onPlaceAnnotation,
  onPageAction,
  onBulkPageAction,
  onPageCountChange,
  onReorderPages,
  pageOrder,
  pageRotations,
  pendingSignature,
  selectedAnnotationId,
  pageActionError,
  pageActionState,
  pageNumberPreview,
  previewUrl,
  sidePanel,
  watermarkPreview
}: StudioPdfViewerProps) {
  const [activePage, setActivePage] = useState(1);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(() => new Set());
  const [pageCount, setPageCount] = useState(Math.max(1, fallbackPageCount));
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [state, setState] = useState<PdfState>(previewUrl ? "loading" : "idle");
  const [zoom, setZoom] = useState(initialZoom);
  const [fitScale, setFitScale] = useState<number | null>(null);
  const [firstPageSize, setFirstPageSize] = useState<PageSize | null>(null);
  const [isPageLayerOpen, setIsPageLayerOpen] = useState(true);
  const [isResultPanelOpen, setIsResultPanelOpen] = useState(!previewUrl);
  const [draggedPage, setDraggedPage] = useState<number | null>(null);
  const [dropTargetPage, setDropTargetPage] = useState<number | null>(null);
  const [formWidgets, setFormWidgets] = useState<PositionedFormWidget[]>([]);
  const [transformingAnnotationId, setTransformingAnnotationId] = useState<string | null>(null);
  const [signatureCursor, setSignatureCursor] = useState<{page: number; x: number; y: number} | null>(null);
  const canvasViewportRef = useRef<HTMLElement | null>(null);
  const annotationTransformRef = useRef<AnnotationTransform | null>(null);
  const pageElementsRef = useRef(new Map<number, HTMLElement>());
  const hasSidePanel = Boolean(sidePanel);

  const formFieldByName = useMemo(() => new Map(formFields.map((field) => [field.name, field])), [formFields]);
  const formFieldNames = useMemo(() => formFields.map((field) => field.name).join("\u0000"), [formFields]);

  useEffect(() => {
    if (!hasSidePanel) return;
    setIsResultPanelOpen(defaultSidePanelOpen || !previewUrl);
  }, [defaultSidePanelOpen, hasSidePanel, previewUrl]);

  useEffect(() => {
    let ignore = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    const controller = new AbortController();

    if (!previewUrl) {
      setPdf(null);
      setState("idle");
      setPageCount(Math.max(1, fallbackPageCount));
      setActivePage(1);
      setZoom(initialZoom);
      setFitScale(null);
      setFirstPageSize(null);
      return;
    }

    const url = previewUrl;

    async function loadPdf() {
      setPdf(null);
      setState("loading");
      setActivePage(1);
      setZoom(initialZoom);
      setFitScale(null);
      setFirstPageSize(null);

      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

      const response = await fetch(url, {cache: "no-store", signal: controller.signal});

      if (!response.ok) {
        if (!ignore) {
          setPdf(null);
          setPageCount(Math.max(1, fallbackPageCount));
          setFitScale(null);
          setFirstPageSize(null);
          setState("error");
        }
        return;
      }

      const data = new Uint8Array(await response.arrayBuffer());
      if (ignore) return;
      loadingTask = pdfjs.getDocument({data});
      const loadedPdf = await loadingTask.promise;

      if (ignore) {
        void loadedPdf.cleanup();
        return;
      }

      setPdf(loadedPdf);
      setPageCount(loadedPdf.numPages);
      onPageCountChange?.(loadedPdf.numPages);
      setState("ready");
    }

    loadPdf().catch(() => {
      if (!ignore) {
        setPdf(null);
        setPageCount(Math.max(1, fallbackPageCount));
        setFitScale(null);
        setFirstPageSize(null);
        setState("error");
      }
    });

    return () => {
      ignore = true;
      controller.abort();
      void loadingTask?.destroy();
    };
  }, [fallbackPageCount, onPageCountChange, previewUrl]);

  useEffect(() => {
    let cancelled = false;

    if (activeTool !== "form" || !pdf || formFields.length === 0) {
      setFormWidgets([]);
      return;
    }

    const knownNames = new Set(formFieldNames.split("\u0000").filter(Boolean));
    const currentPdf = pdf;

    async function loadFormWidgets() {
      const widgets: PositionedFormWidget[] = [];

      for (let pageNumber = 1; pageNumber <= currentPdf.numPages; pageNumber += 1) {
        const page = await currentPdf.getPage(pageNumber);
        const [left, bottom, right, top] = page.view;
        const pageWidth = right - left;
        const pageHeight = top - bottom;
        const annotations = await page.getAnnotations() as Array<{fieldName?: string; rect?: number[]}>;

        for (const annotation of annotations) {
          if (!annotation.fieldName || !annotation.rect || annotation.rect.length !== 4 || !knownNames.has(annotation.fieldName)) continue;
          const [x1, y1, x2, y2] = annotation.rect;
          const widgetLeft = Math.min(x1, x2);
          const widgetRight = Math.max(x1, x2);
          const widgetBottom = Math.min(y1, y2);
          const widgetTop = Math.max(y1, y2);

          if (pageWidth <= 0 || pageHeight <= 0) continue;
          widgets.push({
            height: (widgetTop - widgetBottom) / pageHeight,
            name: annotation.fieldName,
            page: pageNumber,
            width: (widgetRight - widgetLeft) / pageWidth,
            x: (widgetLeft - left) / pageWidth,
            y: 1 - ((widgetTop - bottom) / pageHeight)
          });
        }

        page.cleanup();
      }

      if (!cancelled) setFormWidgets(widgets);
    }

    void loadFormWidgets().catch(() => {
      if (!cancelled) setFormWidgets([]);
    });

    return () => {
      cancelled = true;
    };
  }, [activeTool, formFieldNames, pdf]);

  const canUsePageActions = Boolean(onPageAction);
  const displayedPages = useMemo(() => {
    const validOrder = pageOrder?.filter((page) => Number.isInteger(page) && page >= 1 && page <= pageCount) ?? [];

    if (validOrder.length > 0) return validOrder;

    return pageNumbers(pageCount);
  }, [pageCount, pageOrder]);
  const thumbnailPages = displayedPages;
  const fallbackPages = useMemo(
    () => pageOrder && pageOrder.length > 0 ? pageOrder : pageNumbers(fallbackPageCount, canUsePageActions ? undefined : 6),
    [canUsePageActions, fallbackPageCount, pageOrder]
  );
  const documentPages = displayedPages;

  useEffect(() => {
    setSelectedPages((current) => {
      const valid = new Set([...current].filter((page) => displayedPages.includes(page)));
      return valid.size === current.size ? current : valid;
    });
  }, [displayedPages]);
  const visiblePageCount = Math.max(1, displayedPages.length);
  const canUsePdf = state === "ready" && pdf !== null;
  const zoomPercent = Math.round(zoom * 100);
  const canRenderPdf = canUsePdf && fitScale !== null;
  const renderScale = (fitScale ?? 1) * zoom;
  const canZoomOut = canRenderPdf && zoom > minZoom;
  const canZoomIn = canRenderPdf && zoom < maxZoom;

  useEffect(() => {
    setActivePage((current) => Math.min(Math.max(current, 1), visiblePageCount));
  }, [visiblePageCount]);

  useEffect(() => {
    let ignore = false;

    if (!canUsePdf || !pdf) {
      setFirstPageSize(null);
      setFitScale(null);
      return;
    }

    const currentPdf = pdf;

    async function measureFirstPage() {
      const page = await currentPdf.getPage(1);
      const viewport = page.getViewport({scale: 1});
      page.cleanup();

      if (!ignore) {
        setFirstPageSize({
          height: viewport.height,
          width: viewport.width
        });
      }
    }

    void measureFirstPage();

    return () => {
      ignore = true;
    };
  }, [canUsePdf, pdf]);

  useEffect(() => {
    const viewport = canvasViewportRef.current;

    if (!viewport || !canUsePdf || !firstPageSize) return;

    const scrollViewport = viewport;
    const measuredPageSize = firstPageSize;

    function updateFitScale() {
      const style = window.getComputedStyle(scrollViewport);
      const horizontalPadding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
      const verticalPadding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
      const availableWidth = Math.max(280, scrollViewport.clientWidth - horizontalPadding);
      const availableHeight = Math.max(360, scrollViewport.clientHeight - verticalPadding);
      const nextFitScale = Math.min(
        1,
        availableWidth / measuredPageSize.width,
        availableHeight / measuredPageSize.height
      );

      setFitScale(Number(nextFitScale.toFixed(3)));
    }

    const observer = new ResizeObserver(updateFitScale);
    observer.observe(scrollViewport);
    updateFitScale();

    return () => observer.disconnect();
  }, [canUsePdf, firstPageSize]);

  useEffect(() => {
    const viewport = canvasViewportRef.current;

    if (!viewport || !canRenderPdf) return;

    let frame = 0;
    const scrollViewport = viewport;
    const nearby = new Set<number>();
    const pageByElement = new Map<Element, number>();
    const visibility = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const page = pageByElement.get(entry.target);
        if (page === undefined) continue;
        if (entry.isIntersecting) nearby.add(page);
        else nearby.delete(page);
      }
      handleScroll();
    }, {root: scrollViewport, rootMargin: "200px"});
    for (const [page, element] of pageElementsRef.current) {
      pageByElement.set(element, page);
      if (visibility) visibility.observe(element);
      else nearby.add(page);
    }

    function updateActivePage() {
      frame = 0;
      const viewportTop = scrollViewport.getBoundingClientRect().top;
      let closestPage: number | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const page of nearby) {
        const element = pageElementsRef.current.get(page);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        const distance = Math.abs(rect.top - viewportTop - 24);

        if (rect.bottom > viewportTop && distance < closestDistance) {
          closestPage = page;
          closestDistance = distance;
        }
      }

      if (closestPage !== null) setActivePage((current) => current === closestPage ? current : closestPage);
    }

    function handleScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(updateActivePage);
    }

    scrollViewport.addEventListener("scroll", handleScroll, {passive: true});
    handleScroll();

    return () => {
      scrollViewport.removeEventListener("scroll", handleScroll);
      visibility?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [canRenderPdf, documentPages, zoom]);

  useEffect(() => {
    if (!transformingAnnotationId) return;

    function handlePointerMove(event: globalThis.PointerEvent) {
      const transform = annotationTransformRef.current;

      if (!transform || !onAnnotationChange) return;

      const dx = (event.clientX - transform.startClientX) / transform.pageWidth;
      const dy = (event.clientY - transform.startClientY) / transform.pageHeight;

      if (transform.mode === "move") {
        onAnnotationChange(transform.annotationId, {
          x: clampNumber(transform.startX + dx, 0, Math.max(0, 1 - transform.startWidth)),
          y: clampNumber(transform.startY + dy, 0, Math.max(0, 1 - transform.startHeight))
        });
        return;
      }

      if (transform.mode === "rotate") {
        const pointerAngle = Math.atan2(event.clientY - transform.centerClientY, event.clientX - transform.centerClientX) * 180 / Math.PI;
        const rotation = ((transform.startRotation + pointerAngle - transform.startPointerAngle + 540) % 360) - 180;
        onAnnotationChange(transform.annotationId, {rotation});
        return;
      }

      const patch: Partial<Pick<StudioPdfAnnotation, "height" | "width">> = {};

      if (transform.mode === "resize" || transform.mode === "resizeHeight") {
        patch.height = clampNumber(transform.startHeight + dy, 0.02, Math.max(0.02, 1 - transform.startY));
      }
      if (transform.mode === "resize" || transform.mode === "resizeWidth") {
        patch.width = clampNumber(transform.startWidth + dx, 0.04, Math.max(0.04, 1 - transform.startX));
      }

      onAnnotationChange(transform.annotationId, patch);
    }

    function handlePointerUp() {
      const transform = annotationTransformRef.current;

      if (transform) {
        onAnnotationEditEnd?.(transform.annotationId);
      }

      annotationTransformRef.current = null;
      setTransformingAnnotationId(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, {once: true});
    window.addEventListener("pointercancel", handlePointerUp, {once: true});

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [onAnnotationChange, onAnnotationEditEnd, transformingAnnotationId]);

  function setPageElement(page: number, element: HTMLElement | null) {
    if (element) {
      pageElementsRef.current.set(page, element);
    } else {
      pageElementsRef.current.delete(page);
    }
  }

  function scrollToPage(page: number) {
    const targetPage = Math.min(Math.max(page, 1), visiblePageCount);
    setActivePage(targetPage);
    pageElementsRef.current.get(targetPage)?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  }

  function reorderPages(fromSourcePage: number, toSourcePage: number) {
    if (!onReorderPages || fromSourcePage === toSourcePage) return;

    const nextOrder = movePageInOrder(displayedPages, fromSourcePage, toSourcePage);
    if (nextOrder === displayedPages) return;
    onReorderPages(nextOrder);
  }

  function handleThumbnailDragStart(event: DragEvent<HTMLButtonElement>, sourcePage: number) {
    if (!onReorderPages || pageActionState) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(sourcePage));
    setDraggedPage(sourcePage);
    setDropTargetPage(sourcePage);
  }

  function handleThumbnailDragOver(event: DragEvent<HTMLDivElement>, sourcePage: number) {
    if (!onReorderPages || draggedPage === null || pageActionState) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetPage(sourcePage);
  }

  function handleThumbnailDrop(event: DragEvent<HTMLDivElement>, targetSourcePage: number) {
    if (!onReorderPages || pageActionState) return;

    event.preventDefault();
    const draggedSourcePage = Number(event.dataTransfer.getData("text/plain")) || draggedPage;
    setDraggedPage(null);
    setDropTargetPage(null);

    if (draggedSourcePage) reorderPages(draggedSourcePage, targetSourcePage);
  }

  function handleThumbnailDragEnd() {
    setDraggedPage(null);
    setDropTargetPage(null);
  }

  function handlePagePointerDown(event: PointerEvent<HTMLDivElement>, sourcePage: number) {
    if ((event.target as HTMLElement).closest(".studio-editor-annotation")) return;

    if (activeTool !== "text" && activeTool !== "signature") {
      onAnnotationSelect?.(null);
      return;
    }
    if (!onPlaceAnnotation) return;

    const rect = event.currentTarget.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) return;

    event.preventDefault();
    onAnnotationSelect?.(null);
    onPlaceAnnotation({
      page: sourcePage,
      x: Math.min(0.96, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(0.96, Math.max(0, (event.clientY - rect.top) / rect.height))
    });
    setSignatureCursor(null);
  }

  function handlePagePointerMove(event: PointerEvent<HTMLDivElement>, sourcePage: number) {
    if (activeTool !== "signature" || !pendingSignature) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    setSignatureCursor({
      page: sourcePage,
      x: clampNumber((event.clientX - rect.left) / rect.width, 0, 1),
      y: clampNumber((event.clientY - rect.top) / rect.height, 0, 1)
    });
  }

  function handleInsertPages() {
    const activeSourcePage = displayedPages[Math.min(Math.max(activePage - 1, 0), displayedPages.length - 1)] ?? displayedPages.at(-1) ?? pageCount;
    onInsertPages?.(activeSourcePage);
  }

  function startAnnotationTransform(
    event: PointerEvent<HTMLElement>,
    annotation: StudioPdfAnnotation,
    mode: AnnotationTransformMode
  ) {
    if (!onAnnotationChange) return;

    const pageElement = event.currentTarget.closest(".studio-editor-page");
    const pageRect = pageElement?.getBoundingClientRect();

    if (!pageRect || pageRect.width <= 0 || pageRect.height <= 0) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onAnnotationSelect?.(annotation.id);
    onAnnotationEditStart?.(annotation.id);
    annotationTransformRef.current = {
      annotationId: annotation.id,
      mode,
      pageHeight: pageRect.height,
      pageWidth: pageRect.width,
      startClientX: event.clientX,
      startClientY: event.clientY,
      centerClientX: pageRect.left + (annotation.x + annotation.width / 2) * pageRect.width,
      centerClientY: pageRect.top + (annotation.y + annotation.height / 2) * pageRect.height,
      startPointerAngle: Math.atan2(event.clientY - (pageRect.top + (annotation.y + annotation.height / 2) * pageRect.height), event.clientX - (pageRect.left + (annotation.x + annotation.width / 2) * pageRect.width)) * 180 / Math.PI,
      startRotation: annotation.rotation ?? 0,
      startHeight: annotation.height,
      startWidth: annotation.width,
      startX: annotation.x,
      startY: annotation.y
    };
    setTransformingAnnotationId(annotation.id);
  }

  function resizeModeAtPointer(event: PointerEvent<HTMLElement>): AnnotationTransformMode | null {
    const rect = event.currentTarget.getBoundingClientRect();
    const edge = 10;
    const onRight = event.clientX >= rect.right - edge;
    const onBottom = event.clientY >= rect.bottom - edge;

    if (onRight && onBottom) return "resize";
    if (onRight) return "resizeWidth";
    if (onBottom) return "resizeHeight";
    return null;
  }

  function updateAnnotationCursor(event: PointerEvent<HTMLElement>) {
    const mode = resizeModeAtPointer(event);
    event.currentTarget.style.cursor = mode === "resize" ? "nwse-resize" : mode === "resizeWidth" ? "ew-resize" : mode === "resizeHeight" ? "ns-resize" : "default";
  }

  function renderAnnotations(sourcePage: number) {
    const pageAnnotations = annotations.filter((annotation) => annotation.page === sourcePage);
    const pageFormWidgets = activeTool === "form"
      ? formWidgets.filter((widget) => widget.page === sourcePage)
      : [];
    const pageNumber = displayedPages.indexOf(sourcePage) + 1;
    const pageNumberValue = pageNumberPreview ? pageNumberPreview.startNumber + pageNumber - pageNumberPreview.startPage : 0;
    const pageNumberLabel = pageNumberPreview?.format === "page"
      ? `Page ${pageNumberValue}`
      : pageNumberPreview?.format === "page_of_total"
        ? `${pageNumberValue} / ${pageNumberPreview.startNumber + displayedPages.length - pageNumberPreview.startPage}`
        : String(pageNumberValue);
    const showsPageNumber = Boolean(pageNumberPreview && pageNumber >= pageNumberPreview.startPage);

    const pendingSignatureOnPage = activeTool === "signature" && pendingSignature && signatureCursor?.page === sourcePage ? signatureCursor : null;
    if (pageAnnotations.length === 0 && pageFormWidgets.length === 0 && !watermarkPreview?.text.trim() && !showsPageNumber && !pendingSignatureOnPage) return null;

    return (
      <div className="studio-editor-annotation-layer" aria-label="Annotations">
        {watermarkPreview?.text.trim() ? (
          <div
            aria-hidden="true"
            className={`studio-watermark-preview is-${watermarkPreview.position}`}
            style={{"--watermark-color": watermarkPreview.color, "--watermark-opacity": watermarkPreview.opacity, "--watermark-size": `${watermarkPreview.fontSize}px`} as CSSProperties}
          >
            {watermarkPreview.position === "repeated" ? Array.from({length: 12}, (_, index) => <span key={index}>{watermarkPreview.text}</span>) : <span>{watermarkPreview.text}</span>}
          </div>
        ) : null}
        {showsPageNumber && pageNumberPreview ? (
          <span
            aria-hidden="true"
            className={`studio-page-number-preview is-${pageNumberPreview.position}`}
            style={{"--page-number-color": pageNumberPreview.color, "--page-number-margin": `${pageNumberPreview.margin}px`, "--page-number-size": `${pageNumberPreview.fontSize}px`} as CSSProperties}
          >
            {pageNumberLabel}
          </span>
        ) : null}
        {pendingSignatureOnPage && pendingSignature ? (
          <div
            aria-hidden="true"
            className="studio-editor-signature-ghost"
            style={{
              color: pendingSignature.signatureColor ?? "#141412",
              height: `${pendingSignature.height * 100}%`,
              left: `${clampNumber(pendingSignatureOnPage.x - pendingSignature.width / 2, 0, 1 - pendingSignature.width) * 100}%`,
              top: `${clampNumber(pendingSignatureOnPage.y - pendingSignature.height / 2, 0, 1 - pendingSignature.height) * 100}%`,
              width: `${pendingSignature.width * 100}%`
            }}
          >
            {pendingSignature.signatureImage ? <img alt="" src={pendingSignature.signatureImage} /> : pendingSignature.signatureStrokes?.length ? <svg viewBox="0 0 1 1" preserveAspectRatio="none">{pendingSignature.signatureStrokes.map((stroke, index) => <polyline key={index} points={stroke.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="0.006" strokeLinecap="round" strokeLinejoin="round" />)}</svg> : <span>{pendingSignature.text}</span>}
          </div>
        ) : null}
          {pageAnnotations.map((annotation) => {
          const isSelected = selectedAnnotationId === annotation.id;
          const style: CSSProperties = {
            height: `${annotation.height * 100}%`,
            left: `${annotation.x * 100}%`,
            top: `${annotation.y * 100}%`,
            width: `${annotation.width * 100}%`,
            transform: annotation.rotation ? `rotate(${annotation.rotation}deg)` : undefined,
            transformOrigin: "center",
            ...(annotation.type === "text" ? {
              color: annotation.textColor ?? "#141412",
              fontFamily: annotation.fontFamily === "serif" ? "Georgia, 'Times New Roman', serif" : annotation.fontFamily === "mono" ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "var(--font-sans)",
              fontSize: `${annotation.fontSize ?? 14}px`,
              fontWeight: annotation.bold ? 700 : 500,
              textAlign: annotation.textAlign ?? "left"
            } : annotation.type === "signature" ? {
              color: annotation.signatureColor ?? "#141412",
              fontFamily: annotation.signatureStyle === "elegant" ? "Georgia, 'Times New Roman', serif" : annotation.signatureStyle === "plain" ? "var(--font-sans)" : "'Brush Script MT', 'Segoe Script', cursive",
              fontStyle: annotation.signatureStyle === "plain" ? "normal" : "italic",
              fontWeight: 500
            } : {})
          };

          return (
            <div
              className={`studio-editor-annotation ${annotation.type} ${isSelected ? "is-selected" : ""}${transformingAnnotationId === annotation.id ? " is-transforming" : ""}`}
              key={annotation.id}
              style={style}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (!isSelected) {
                  startAnnotationTransform(event, annotation, "move");
                  return;
                }
                const mode = resizeModeAtPointer(event);
                if (mode) {
                  startAnnotationTransform(event, annotation, mode);
                  return;
                }
                startAnnotationTransform(event, annotation, "move");
              }}
              onPointerLeave={(event) => { event.currentTarget.style.cursor = "default"; }}
              onPointerMove={(event) => {
                updateAnnotationCursor(event);
                if (!isSelected && !resizeModeAtPointer(event)) event.currentTarget.style.cursor = "grab";
              }}
            >
              {annotation.type === "text" ? (
                <textarea
                  aria-label="PDF text annotation"
                  value={annotation.text}
                  onBlur={() => {
                    onAnnotationEditEnd?.(annotation.id);
                  }}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                    onAnnotationChange?.(annotation.id, {text: event.currentTarget.value});
                  }}
                  onFocus={() => {
                    onAnnotationEditStart?.(annotation.id);
                  }}
                />
              ) : annotation.signatureImage ? (
                <img alt="Signature importée" className="studio-editor-signature-image" src={annotation.signatureImage} />
              ) : annotation.signatureStrokes?.length ? (
                <svg className="studio-editor-signature-drawing" viewBox="0 0 1 1" preserveAspectRatio="none" aria-label="Signature dessinée">{annotation.signatureStrokes.map((stroke, index) => <polyline key={index} points={stroke.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="0.006" strokeLinecap="round" strokeLinejoin="round" />)}</svg>
              ) : (
                <span>{annotation.text}</span>
              )}
              {isSelected && annotation.type === "signature" ? <>
                <span aria-hidden="true" className="studio-editor-annotation-corner is-top-left" />
                <span aria-hidden="true" className="studio-editor-annotation-corner is-top-right" />
                <span aria-hidden="true" className="studio-editor-annotation-corner is-bottom-left" />
                <button aria-label="Redimensionner la signature" className="studio-editor-annotation-resize" type="button" onPointerDown={(event) => startAnnotationTransform(event, annotation, "resize")} />
                <button aria-label="Pivoter la signature" className="studio-editor-annotation-rotate" type="button" onPointerDown={(event) => startAnnotationTransform(event, annotation, "rotate")}><i className="ti ti-rotate-2" aria-hidden="true" /></button>
              </> : null}
              {isSelected && annotation.type === "text" ? <>
                <span aria-hidden="true" className="studio-editor-annotation-width-cue" />
                <span aria-hidden="true" className="studio-editor-annotation-height-cue" />
              </> : null}
              <button
                aria-label={labels.removeAnnotation}
                className="studio-editor-annotation-delete"
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onAnnotationDelete?.(annotation.id);
                }}
              >
                <i className="ti ti-trash" aria-hidden="true" />
              </button>
            </div>
          );
          })}
          {pageFormWidgets.map((widget, index) => {
            const field = formFieldByName.get(widget.name);
            if (!field) return null;
            const style: CSSProperties = {
              height: `${Math.max(0.018, widget.height) * 100}%`,
              left: `${Math.max(0, widget.x) * 100}%`,
              top: `${Math.max(0, widget.y) * 100}%`,
              width: `${Math.max(0.03, widget.width) * 100}%`
            };
            const duplicateRadioOrSelect = (field.type === "radio" || field.type === "select") && pageFormWidgets.slice(0, index).some((item) => item.name === field.name);
            if (duplicateRadioOrSelect) return null;

            return (
              <label className={`studio-pdf-form-widget is-${field.type}`} key={`${widget.page}-${widget.name}-${index}`} style={style}>
                <span className="sr-only">{field.name}</span>
                {field.type === "checkbox" ? (
                  <input checked={Boolean(field.value)} type="checkbox" onChange={(event) => onFormFieldChange?.(field.name, event.currentTarget.checked)} />
                ) : field.type === "text" ? (
                  <input maxLength={field.maxLength} type="text" value={String(field.value)} onChange={(event) => onFormFieldChange?.(field.name, event.currentTarget.value)} />
                ) : (
                  <select value={String(field.value)} onChange={(event) => onFormFieldChange?.(field.name, event.currentTarget.value)}>
                    <option value="" />
                    {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                )}
              </label>
            );
          })}
        </div>
    );
  }

  function renderPageActionControls(displayPage: number, sourcePage: number) {
    if (!onPageAction) return null;

    const activeAction = pageActionState?.page === sourcePage ? pageActionState.action : null;
    const hasRunningPageAction = pageActionState != null;
    const canDeletePage = visiblePageCount > 1;

    return (
      <div className="studio-editor-thumb-actions" aria-label={pageActionLabel(labels.thumbnails, displayPage)}>
        <button
          aria-label={pageActionLabel(labels.pageActions.extract, displayPage)}
          disabled={hasRunningPageAction}
          title={pageActionLabel(labels.pageActions.extract, displayPage)}
          type="button"
          onClick={() => onPageAction("extract", sourcePage)}
        >
          <i className={`ti ${activeAction === "extract" ? "ti-loader-2" : "ti-file-export"}`} aria-hidden="true" />
        </button>
        <button
          aria-label={pageActionLabel(labels.pageActions.rotate, displayPage)}
          disabled={hasRunningPageAction}
          title={pageActionLabel(labels.pageActions.rotate, displayPage)}
          type="button"
          onClick={() => onPageAction("rotate", sourcePage)}
        >
          <i className={`ti ${activeAction === "rotate" ? "ti-loader-2" : "ti-rotate-clockwise"}`} aria-hidden="true" />
        </button>
        <button
          aria-label={pageActionLabel(labels.pageActions.delete, displayPage)}
          disabled={hasRunningPageAction || !canDeletePage}
          title={canDeletePage ? pageActionLabel(labels.pageActions.delete, displayPage) : labels.pageActions.cannotDeleteLastPage}
          type="button"
          onClick={() => onPageAction("delete", sourcePage)}
        >
          <i className={`ti ${activeAction === "delete" ? "ti-loader-2" : "ti-trash"}`} aria-hidden="true" />
        </button>
      </div>
    );
  }

  function toggleSelectedPage(sourcePage: number) {
    setSelectedPages((current) => {
      const next = new Set(current);
      if (next.has(sourcePage)) next.delete(sourcePage);
      else next.add(sourcePage);
      return next;
    });
  }

  return (
    <div className={`studio-editor-body${hasSidePanel ? " has-side-panel" : ""}${isPageLayerOpen ? "" : " pages-collapsed"}${hasSidePanel && !isResultPanelOpen ? " result-collapsed" : ""}`}>
      {isPageLayerOpen ? (
        <aside className="studio-editor-thumbnails" aria-label={labels.thumbnails}>
          <div className="studio-editor-thumbnails-header">
            <h2>{labels.thumbnails}</h2>
            <button
              aria-expanded="true"
              aria-label={labels.hideThumbnails}
              className="studio-editor-thumbnails-toggle"
              title={labels.hideThumbnails}
              type="button"
              onClick={() => setIsPageLayerOpen(false)}
            >
              <i className="ti ti-chevron-left" aria-hidden="true" />
            </button>
          </div>
          {onBulkPageAction && selectedPages.size > 0 ? (
            <div className="studio-editor-selection-actions" aria-label={labels.pageActions.selected.replace("{count}", String(selectedPages.size))}>
              <span>{labels.pageActions.selected.replace("{count}", String(selectedPages.size))}</span>
              <button type="button" title={labels.pageActions.extractSelection} disabled={pageActionState != null} onClick={() => onBulkPageAction("extract", [...selectedPages])}>
                <i className="ti ti-file-export" aria-hidden="true" />
              </button>
              <button type="button" title={labels.pageActions.deleteSelection} disabled={pageActionState != null || selectedPages.size >= displayedPages.length} onClick={() => onBulkPageAction("delete", [...selectedPages])}>
                <i className="ti ti-trash" aria-hidden="true" />
              </button>
              <button type="button" title={labels.pageActions.clearSelection} disabled={pageActionState != null} onClick={() => setSelectedPages(new Set())}>
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>
          ) : null}
          {canUsePdf ? (
            thumbnailPages.map((sourcePage, index) => {
              const displayPage = index + 1;
              const rotation = pageRotations?.[sourcePage] ?? 0;

              return (
                <div
                  className={`studio-editor-thumb-item${displayPage === activePage ? " active" : ""}${selectedPages.has(sourcePage) ? " is-selected" : ""}${sourcePage === dropTargetPage && draggedPage !== sourcePage ? " is-drop-target" : ""}`}
                  key={sourcePage}
                  onDragOver={(event) => handleThumbnailDragOver(event, sourcePage)}
                  onDrop={(event) => handleThumbnailDrop(event, sourcePage)}
                  >
                  {onBulkPageAction ? (
                    <button
                      aria-label={pageActionLabel(labels.pageActions.select, displayPage)}
                      aria-pressed={selectedPages.has(sourcePage)}
                      className="studio-editor-thumb-multiselect"
                      title={pageActionLabel(labels.pageActions.select, displayPage)}
                      type="button"
                      onClick={() => toggleSelectedPage(sourcePage)}
                    >
                      <i className={`ti ${selectedPages.has(sourcePage) ? "ti-check" : "ti-plus"}`} aria-hidden="true" />
                    </button>
                  ) : null}
                  <button
                    className="studio-editor-thumb-select"
                    draggable={Boolean(onReorderPages) && visiblePageCount > 1}
                    type="button"
                    onDragEnd={handleThumbnailDragEnd}
                    onDragStart={(event) => handleThumbnailDragStart(event, sourcePage)}
                    onClick={() => scrollToPage(displayPage)}
                  >
                    <span className="studio-editor-thumb-paper">
                      <PdfCanvas
                        className="studio-editor-thumb-canvas"
                        pageNumber={sourcePage}
                        pdf={pdf}
                        rotation={rotation}
                        scale={0.22}
                      />
                    </span>
                    <em>{displayPage}</em>
                  </button>
                  {renderPageActionControls(displayPage, sourcePage)}
                </div>
              );
            })
          ) : (
            fallbackPages.map((sourcePage, index) => {
              const displayPage = index + 1;

              return (
              <div className={`studio-editor-thumb-item${displayPage === activePage ? " active" : ""}`} key={sourcePage}>
                <button className="studio-editor-thumb-select" type="button" disabled>
                  <span className="studio-editor-thumb-paper">
                    <i className="ti ti-file-text" aria-hidden="true" />
                    <small />
                    <small />
                    <small />
                  </span>
                  <em>{displayPage}</em>
                </button>
                {renderPageActionControls(displayPage, sourcePage)}
              </div>
              );
            })
          )}
          {pageActionError ? <p className="studio-editor-page-action-error">{pageActionError || labels.pageActions.error}</p> : null}
          <button
            className="studio-editor-add-page"
            type="button"
            disabled={!onInsertPages}
            title={onInsertPages ? labels.addFile : labels.comingSoon}
            onClick={handleInsertPages}
          >
            <i className="ti ti-plus" aria-hidden="true" />
            <span>{labels.addFile}</span>
          </button>
        </aside>
      ) : (
        <aside className="studio-editor-thumbnails-collapsed" aria-label={labels.thumbnails}>
          <button
            aria-expanded="false"
            aria-label={labels.showThumbnails}
            className="studio-editor-pages-open"
            title={labels.showThumbnails}
            type="button"
            onClick={() => setIsPageLayerOpen(true)}
          >
            <i className="ti ti-layout-sidebar-left-expand" aria-hidden="true" />
            <span>{activePage}</span>
          </button>
        </aside>
      )}

      <section className="studio-editor-canvas" aria-label={labels.preview} ref={canvasViewportRef}
        onPointerDownCapture={(event) => {
          if (!(event.target as HTMLElement).closest(".studio-editor-annotation, .studio-editor-zoom")) onAnnotationSelect?.(null);
        }}>
        {canRenderPdf ? (
          <div className="studio-editor-pages">
            {documentPages.map((sourcePage, index) => {
              const displayPage = index + 1;
              const rotation = pageRotations?.[sourcePage] ?? 0;

              return (
              <article
                className={`studio-editor-page-shell${displayPage === activePage ? " active" : ""}`}
                key={sourcePage}
                ref={(element) => setPageElement(displayPage, element)}
              >
                <span className="studio-editor-page-marker">{displayPage}</span>
                <div
                  className={`studio-editor-page${activeTool === "text" || activeTool === "signature" ? " is-placement-mode" : ""}`}
                  onPointerDown={(event) => handlePagePointerDown(event, sourcePage)}
                  onPointerMove={(event) => handlePagePointerMove(event, sourcePage)}
                >
                  <PdfCanvas
                    className="studio-editor-page-canvas"
                    pageNumber={sourcePage}
                    pdf={pdf}
                    rotation={rotation}
                    scale={renderScale}
                  />
                  {renderAnnotations(sourcePage)}
                </div>
              </article>
              );
            })}
          </div>
        ) : (
          <div className="studio-editor-page">
            {state === "loading" || canUsePdf ? (
              <div className="studio-editor-viewer-state">
                <i className="ti ti-loader-2" aria-hidden="true" />
                <strong>{labels.loading}</strong>
              </div>
            ) : state === "error" ? (
              <div className="studio-editor-viewer-state">
                <i className="ti ti-file-alert" aria-hidden="true" />
                <strong>{labels.unavailableTitle}</strong>
                <span>{labels.unavailableText}</span>
              </div>
            ) : (
              <div className="studio-editor-file">
                <i className="ti ti-file-description" aria-hidden="true" />
                <strong title={name}>{name}</strong>
                <span title={actionLabel}>{actionLabel}</span>
              </div>
            )}
          </div>
        )}
        <div className="studio-editor-zoom" aria-label={`${labels.preview} zoom`}>
          <button title="Page précédente" type="button" disabled={!canUsePdf || activePage <= 1} onClick={() => scrollToPage(activePage - 1)}>
            <i className="ti ti-chevron-left" aria-hidden="true" />
          </button>
          <span>{`${activePage} / ${visiblePageCount}`}</span>
          <button title="Page suivante" type="button" disabled={!canUsePdf || activePage >= visiblePageCount} onClick={() => scrollToPage(activePage + 1)}>
            <i className="ti ti-chevron-right" aria-hidden="true" />
          </button>
          <span aria-hidden="true" className="studio-editor-zoom-divider" />
          <button title="Réduire le zoom" type="button" disabled={!canZoomOut} onClick={() => setZoom(nextZoom(zoom, "out"))}>
            <i className="ti ti-zoom-out" aria-hidden="true" />
          </button>
          <strong>{`${zoomPercent}%`}</strong>
          <button title="Augmenter le zoom" type="button" disabled={!canZoomIn} onClick={() => setZoom(nextZoom(zoom, "in"))}>
            <i className="ti ti-zoom-in" aria-hidden="true" />
          </button>
        </div>
      </section>
      {sidePanel && isResultPanelOpen ? (
        <aside className="studio-editor-result-panel" aria-label={labels.resultPanel}>
          <button
            aria-expanded="true"
            aria-label={labels.hideResultPanel}
            className="studio-editor-result-toggle"
            title={labels.hideResultPanel}
            type="button"
            onClick={() => setIsResultPanelOpen(false)}
          >
            <i className="ti ti-chevron-right" aria-hidden="true" />
          </button>
          {sidePanel}
        </aside>
      ) : sidePanel ? (
        <aside className="studio-editor-result-collapsed" aria-label={labels.resultPanel}>
          <button
            aria-expanded="false"
            aria-label={labels.showResultPanel}
            className="studio-editor-result-open"
            title={labels.showResultPanel}
            type="button"
            onClick={() => setIsResultPanelOpen(true)}
          >
            <i className="ti ti-layout-sidebar-right-expand" aria-hidden="true" />
            <span>{labels.resultPanel}</span>
          </button>
        </aside>
      ) : null}
    </div>
  );
}
