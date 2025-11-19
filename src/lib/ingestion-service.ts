import { Icon } from "@/types/schema";
import { fetchRepoContents, fetchRawFile, GitHubFile } from "./github-api";

export async function ingestGitHubRepo(
    repoUrl: string,
    path: string,
    onProgress?: (current: number, total: number, status: string) => void
): Promise<Icon[]> {
    // 1. Parse Repo URL
    // Handle full URLs like https://github.com/owner/repo/tree/main/path
    let cleanRepoUrl = repoUrl.replace("https://github.com/", "");
    if (cleanRepoUrl.includes("/tree/")) {
        cleanRepoUrl = cleanRepoUrl.split("/tree/")[0];
    }

    const parts = cleanRepoUrl.split("/");
    if (parts.length < 2) throw new Error("Invalid GitHub URL");
    const [owner, repo] = parts;

    // 2. Sanitize Path
    // Remove leading slashes and "tree/branch/" if present in the path argument
    let cleanPath = path.replace(/^\/+/, ""); // Remove leading slash
    if (cleanPath.startsWith("tree/")) {
        // Attempt to remove tree/branch/
        // We assume the branch is the next segment. This is a heuristic.
        const pathParts = cleanPath.split("/");
        if (pathParts.length >= 2) {
            // Remove "tree" and "branch"
            cleanPath = pathParts.slice(2).join("/");
        }
    }

    // 3. Fetch File List
    onProgress?.(0, 0, "Fetching file list...");
    const files = await fetchRepoContents(owner, repo, cleanPath);
    const svgFiles = files.filter(f => f.name.endsWith(".svg"));

    if (svgFiles.length === 0) {
        throw new Error("No SVG files found in the specified path.");
    }

    const ingestedIcons: Icon[] = [];
    let completed = 0;

    // 4. Process each file
    // Limit concurrency to avoid browser/network limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < svgFiles.length; i += BATCH_SIZE) {
        const batch = svgFiles.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (file) => {
            try {
                onProgress?.(completed, svgFiles.length, `Processing ${file.name}...`);
                const rawSvg = await fetchRawFile(file.download_url);
                // Pass full path for unique ID generation
                const icon = parseSvg(rawSvg, file.path, file.name, repo);
                if (icon) {
                    ingestedIcons.push(icon);
                }
            } catch (err) {
                console.warn(`Failed to process ${file.name}`, err);
            } finally {
                completed++;
            }
        }));
    }

    return ingestedIcons;
}

function parseSvg(svgContent: string, fullPath: string, filename: string, libraryName: string): Icon | null {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");
    const svgElement = doc.querySelector("svg");

    if (!svgElement) return null;

    const viewBox = svgElement.getAttribute("viewBox") || "0 0 24 24";

    // Heuristic to determine render style
    // 1. Check SVG attributes
    const svgFill = svgElement.getAttribute("fill");
    const svgStroke = svgElement.getAttribute("stroke");

    // 2. Check Path attributes (first path)
    const firstPath = doc.querySelector("path");
    const pathFill = firstPath?.getAttribute("fill");
    const pathStroke = firstPath?.getAttribute("stroke");
    const fillRule = firstPath?.getAttribute("fill-rule") || undefined;
    const clipRule = firstPath?.getAttribute("clip-rule") || undefined;

    let renderStyle: "stroke" | "fill" = "stroke"; // Default to stroke (Lucide style)

    // If explicit fill is set (and not none), or stroke is none/null while fill is present
    if (
        (svgFill && svgFill !== "none") ||
        (pathFill && pathFill !== "none") ||
        (svgElement.getAttribute("class")?.includes("bi")) // Bootstrap Icons specific check
    ) {
        renderStyle = "fill";
    }

    // If explicit stroke is set, prefer stroke (unless it's Bootstrap which mixes them but is primarily fill for shapes)
    if (svgStroke && svgStroke !== "none") {
        renderStyle = "stroke";
    }

    // Bootstrap Icons (twbs) are fill-based usually, even if they have stroke sometimes.
    // But let's trust the attributes. 
    // If fill="currentColor" is present, it's likely fill.
    if (svgFill === "currentColor" || pathFill === "currentColor") {
        renderStyle = "fill";
    }

    // Extract all paths and convert shapes to paths
    const elements = Array.from(svgElement.querySelectorAll("path, rect, circle, ellipse, line, polyline, polygon"));
    const paths = elements
        .map(el => elementToPath(el))
        .filter(Boolean)
        .join(" ");

    if (!paths) return null;

    const name = filename.replace(".svg", "").replace(/[-_]/g, " ");

    // Use full path for unique ID to prevent collisions in libraries with subdirectories
    // e.g., Font Awesome has brands/font-awesome.svg and regular/font-awesome.svg
    const uniqueId = fullPath.replace(/\//g, "-").replace(".svg", "");

    return {
        id: `${libraryName}-${uniqueId}`,
        name: name,
        library: libraryName,
        style: "outline",
        renderStyle,
        fillRule,
        clipRule,
        path: paths,
        viewBox: viewBox,
        tags: name.split(" "),
        categories: ["imported"],
        synonyms: []
    };
}

// Helper to convert SVG shapes to path commands
function elementToPath(element: Element): string | null {
    const tagName = element.tagName.toLowerCase();

    switch (tagName) {
        case "path":
            return element.getAttribute("d");

        case "rect": {
            const x = parseFloat(element.getAttribute("x") || "0");
            const y = parseFloat(element.getAttribute("y") || "0");
            const w = parseFloat(element.getAttribute("width") || "0");
            const h = parseFloat(element.getAttribute("height") || "0");
            const rx = parseFloat(element.getAttribute("rx") || "0");
            const ry = parseFloat(element.getAttribute("ry") || "0");

            if (rx || ry) {
                // Rounded rect (simplified, handling uniform radius)
                const r = rx || ry;
                return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
            }
            return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
        }

        case "circle": {
            const cx = parseFloat(element.getAttribute("cx") || "0");
            const cy = parseFloat(element.getAttribute("cy") || "0");
            const r = parseFloat(element.getAttribute("r") || "0");
            return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
        }

        case "ellipse": {
            const cx = parseFloat(element.getAttribute("cx") || "0");
            const cy = parseFloat(element.getAttribute("cy") || "0");
            const rx = parseFloat(element.getAttribute("rx") || "0");
            const ry = parseFloat(element.getAttribute("ry") || "0");
            return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
        }

        case "line": {
            const x1 = element.getAttribute("x1");
            const y1 = element.getAttribute("y1");
            const x2 = element.getAttribute("x2");
            const y2 = element.getAttribute("y2");
            return `M ${x1} ${y1} L ${x2} ${y2}`;
        }

        case "polyline": {
            const points = element.getAttribute("points");
            if (!points) return null;
            const pairs = points.trim().split(/\s+|,/);
            // Basic parsing, assuming valid points string
            // M p1 L p2 L p3 ...
            // Actually, points string is just "x,y x,y"
            // We need to format it to "M x y L x y"
            // But simpler: just use the points string if we construct it carefully
            // Let's parse it properly
            // Actually, polyline is just M first L rest
            // But points attribute syntax is flexible.
            // Let's assume standard "x,y x,y" or "x y x y"
            // A robust way is to let the browser parse it? No we are in logic.
            // Let's just replace the first space/comma with M and subsequent with L?
            // Too risky. 
            // Let's try a simple regex replacement for now:
            // "10,10 20,20" -> "M 10 10 L 20 20"
            // This is complex to do perfectly without a full parser.
            // For Lucide, points are usually "x,y x,y".
            // Let's try to clean it up.
            const cleaned = points.trim().replace(/,/g, " ");
            const coords = cleaned.split(/\s+/);
            if (coords.length < 2) return null;
            let d = `M ${coords[0]} ${coords[1]}`;
            for (let i = 2; i < coords.length; i += 2) {
                d += ` L ${coords[i]} ${coords[i + 1]}`;
            }
            return d;
        }

        case "polygon": {
            const points = element.getAttribute("points");
            if (!points) return null;
            const cleaned = points.trim().replace(/,/g, " ");
            const coords = cleaned.split(/\s+/);
            if (coords.length < 2) return null;
            let d = `M ${coords[0]} ${coords[1]}`;
            for (let i = 2; i < coords.length; i += 2) {
                d += ` L ${coords[i]} ${coords[i + 1]}`;
            }
            return d + " Z";
        }

        default:
            return null;
    }
}
