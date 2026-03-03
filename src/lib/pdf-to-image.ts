export interface PdfImageResult {
    blob: Blob;
    numPages: number;
}

export async function pdfToImage(pdfData: ArrayBuffer): Promise<PdfImageResult> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const numPages = pdf.numPages;

    // Cap scale: use 2x for 1-3 pages, reduce for larger docs to keep file size sane
    const dpr = window.devicePixelRatio || 1;
    const baseScale = Math.min(2, dpr);
    const scale = numPages > 5 ? Math.min(1.5, baseScale) : baseScale;

    // Render every page and measure total height
    const pageCanvases: HTMLCanvasElement[] = [];
    let totalHeight = 0;
    let maxWidth = 0;

    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = viewport.width;
        pageCanvas.height = viewport.height;

        await page.render({ canvas: pageCanvas, viewport } as any).promise;

        pageCanvases.push(pageCanvas);
        totalHeight += viewport.height;
        if (viewport.width > maxWidth) maxWidth = viewport.width;
    }

    // Stitch all pages into one tall canvas
    const canvas = document.createElement('canvas');
    canvas.width = maxWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d')!;

    let yOffset = 0;
    for (const pc of pageCanvases) {
        ctx.drawImage(pc, 0, yOffset);
        yOffset += pc.height;
    }

    // Always use PNG (lossless) — sealed documents must survive multiple re-seals
    // without quality degradation. JPEG cascading compression is the pixelation bug.
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
            'image/png'
        );
    });

    return { blob, numPages };
}
