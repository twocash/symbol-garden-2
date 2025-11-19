import { Icon } from "@/types/schema";

function createSvgString(icon: Icon, size: number, color: string): string {
    const isFill = icon.renderStyle === "fill";
    const fillAttr = isFill ? color : "none";
    const strokeAttr = isFill ? "none" : color;
    const strokeWidth = isFill ? "0" : "2";

    return `<svg viewBox="${icon.viewBox}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><path d="${icon.path}" fill-rule="${icon.fillRule || ''}" clip-rule="${icon.clipRule || ''}"/></svg>`;
}

export async function downloadPng(icon: Icon, size = 256, color = "#000000") {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const svgString = createSvgString(icon, size, color);

    const img = new Image();
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL("image/png");

        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `${icon.name}-${size}px.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    img.src = url;
}

export async function downloadSvg(icon: Icon, size = 256, color = "#000000") {
    const svgString = createSvgString(icon, size, color);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${icon.name}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function copySvg(icon: Icon, size = 24, color = "currentColor") {
    const svgString = createSvgString(icon, size, color);
    await navigator.clipboard.writeText(svgString);
}

export async function copyPng(icon: Icon, size = 256, color = "#000000") {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const svgString = createSvgString(icon, size, color);

    const img = new Image();
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    return new Promise<void>((resolve, reject) => {
        img.onload = () => {
            ctx.clearRect(0, 0, size, size);
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(async (blob) => {
                if (blob) {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ "image/png": blob })
                        ]);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                } else {
                    reject(new Error("Canvas to Blob failed"));
                }
                URL.revokeObjectURL(url);
            });
        };
        img.onerror = reject;
        img.src = url;
    });
}
