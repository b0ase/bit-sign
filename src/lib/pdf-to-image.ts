export async function pdfToImage(pdfData: ArrayBuffer): Promise<Blob> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const scale = 2 * (window.devicePixelRatio || 1);

    // Render every page and measure total height
    const pageCanvases: HTMLCanvasElement[] = [];
    let totalHeight = 0;
    let maxWidth = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
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

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
            'image/png'
        );
    });
}
