"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProject } from "@/lib/project-context";
import { useSearch } from "@/lib/search-context";
import { getIconSources } from "@/lib/storage";
import { getRelatedSearchTerms } from "@/lib/iconify-service";
import { extractCombinedPathData } from "@/lib/svg-path-utils";
import { toast } from "sonner";
import { Loader2, Sparkles, Check, Download, Settings2, Globe, Import, Library, CheckCircle2, AlertCircle, AlertTriangle, Puzzle, Wand2, ChevronRight, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// P2: Iconify match interface
interface IconifyMatch {
    iconId: string;  // e.g., "lucide:bike"
    svg: string;
    collection: string;
}

// P3b: Library icon match interface
interface LibraryMatch {
    id: string;
    name: string;
    library: string;
    path: string;
    viewBox: string;
}

// F2: Compliance result from Sprout Engine
interface ComplianceInfo {
    passed: boolean;
    score: number;
    violations: Array<{
        rule: string;
        expected: string;
        actual: string;
        severity: 'error' | 'warning';
        autoFixed: boolean;
    }>;
    changesApplied: number;
}

// F5: Kitbash plan types
interface KitbashLayout {
    name: string;
    description: string;
}

interface KitbashMatch {
    partName: string;
    sourceIcon: string;
    confidence: number;
}

interface KitbashPlanResult {
    concept: string;
    requiredParts: string[];
    foundParts: KitbashMatch[];
    missingParts: string[];
    coverage: number;
    strategy: 'graft' | 'hybrid' | 'generate' | 'adapt';
    suggestedLayouts: KitbashLayout[];
}

interface AIIconGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AIIconGeneratorModal({ isOpen, onClose }: AIIconGeneratorModalProps) {
    const { currentProject, addIconToProject } = useProject();
    const { icons: globalIcons, libraries } = useSearch();
    const [prompt, setPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedSvgs, setGeneratedSvgs] = useState<string[]>([]);
    const [selectedSvgIndex, setSelectedSvgIndex] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Generation options
    const [libraryOverride, setLibraryOverride] = useState<string | null>(null);
    const [variantCount, setVariantCount] = useState<number>(3);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [fewShotCount, setFewShotCount] = useState<number>(4);
    const [temperature, setTemperature] = useState<number>(0.2);

    // Metadata from generation
    const [metadata, setMetadata] = useState<{
        fewShotExamples?: string[];
        decompositionSource?: string;
        attempts?: number;
    } | null>(null);

    // Icon sources (for accessing styleManifest)
    const [iconSources, setIconSources] = useState<Array<{
        id: string;
        name: string;
        styleManifest?: string;
    }>>([]);

    // P2: Iconify search state ("Borrow & Adapt")
    const [iconifyMatches, setIconifyMatches] = useState<IconifyMatch[]>([]);
    const [isSearchingIconify, setIsSearchingIconify] = useState(false);
    const [selectedIconifyMatch, setSelectedIconifyMatch] = useState<IconifyMatch | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    // P3b: Library pre-check state
    const [libraryMatches, setLibraryMatches] = useState<LibraryMatch[]>([]);
    const [selectedLibraryMatch, setSelectedLibraryMatch] = useState<LibraryMatch | null>(null);

    // P3c: Related search terms
    const relatedTerms = prompt.trim().length >= 2 ? getRelatedSearchTerms(prompt.trim()) : [];

    // F2: Compliance data from generation
    const [compliance, setCompliance] = useState<ComplianceInfo | null>(null);

    // F2: Ghost preview neighbors (random library icons for context)
    const [ghostNeighbors, setGhostNeighbors] = useState<{ left: LibraryMatch | null; right: LibraryMatch | null }>({
        left: null,
        right: null,
    });

    // F5: Kitbash mode state
    const [generationMode, setGenerationMode] = useState<'generate' | 'kitbash'>('generate');
    const [kitbashPlan, setKitbashPlan] = useState<KitbashPlanResult | null>(null);
    const [isPlanning, setIsPlanning] = useState(false);
    const [selectedLayoutIndex, setSelectedLayoutIndex] = useState(0);
    const [kitbashSvg, setKitbashSvg] = useState<string | null>(null);
    const [isExecutingKitbash, setIsExecutingKitbash] = useState(false);

    // Refinery state (Sprint 06: transforms draft assemblies into cohesive icons)
    const [isRefining, setIsRefining] = useState(false);
    const [refinedSvg, setRefinedSvg] = useState<string | null>(null);
    const [refinementChanges, setRefinementChanges] = useState<string[]>([]);
    const [showRefinedView, setShowRefinedView] = useState(true); // Toggle between draft/refined

    // Determine available libraries from ingested icons
    const availableLibraries = libraries.filter(lib => lib !== "custom");

    // Derive favorites and detect dominant library
    const favorites = currentProject?.favorites
        .map(id => globalIcons.find(i => i.id === id))
        .filter((icon): icon is NonNullable<typeof icon> => !!icon && !!icon.path) || [];

    // Detect dominant library from favorites (like the original flow)
    const detectedLibrary = (() => {
        if (favorites.length >= 3) {
            const libraryCount: Record<string, number> = {};
            favorites.forEach(icon => {
                if (icon.library) {
                    libraryCount[icon.library] = (libraryCount[icon.library] || 0) + 1;
                }
            });
            const sorted = Object.entries(libraryCount).sort((a, b) => b[1] - a[1]);
            if (sorted.length > 0) {
                return { library: sorted[0][0], count: sorted[0][1], total: favorites.length };
            }
        }
        // Fallback: use the library with most icons
        if (availableLibraries.length > 0) {
            const libCounts = availableLibraries.map(lib => ({
                lib,
                count: globalIcons.filter(i => i.library === lib).length
            }));
            libCounts.sort((a, b) => b.count - a.count);
            return { library: libCounts[0].lib, count: libCounts[0].count, total: globalIcons.length, fromAll: true };
        }
        return null;
    })();

    // The effective library to use
    const effectiveLibrary = libraryOverride || detectedLibrary?.library || availableLibraries[0];

    // Reset state when opening and load icon sources
    useEffect(() => {
        if (isOpen) {
            setPrompt("");
            setGeneratedSvgs([]);
            setSelectedSvgIndex(null);
            setMetadata(null);
            setLibraryOverride(null); // Reset override on open
            setIconifyMatches([]); // P2: Reset Iconify matches
            setSelectedIconifyMatch(null);
            setLibraryMatches([]); // P3b: Reset library matches
            setSelectedLibraryMatch(null);
            setCompliance(null); // F2: Reset compliance
            setGhostNeighbors({ left: null, right: null }); // F2: Reset ghost neighbors
            // F5: Reset kitbash state
            setKitbashPlan(null);
            setSelectedLayoutIndex(0);
            setKitbashSvg(null);

            // Refinery: Reset refinement state
            setRefinedSvg(null);
            setRefinementChanges([]);
            setShowRefinedView(true);

            // Load icon sources to access styleManifest
            getIconSources().then(sources => {
                setIconSources(sources);
            });
        }
    }, [isOpen]);

    // P3b: Search user's library when concept changes
    useEffect(() => {
        if (!prompt.trim() || prompt.length < 2) {
            setLibraryMatches([]);
            return;
        }

        const searchTerm = prompt.trim().toLowerCase();

        // Search globalIcons for matching names or tags
        const matches = globalIcons
            .filter(icon => {
                const nameMatch = icon.name.toLowerCase().includes(searchTerm);
                const tagMatch = icon.tags?.some(tag => tag.toLowerCase().includes(searchTerm));
                return (nameMatch || tagMatch) && icon.path;
            })
            .slice(0, 6) // Limit to 6 matches
            .map(icon => ({
                id: icon.id,
                name: icon.name,
                library: icon.library || "custom",
                path: icon.path || "",
                viewBox: icon.viewBox || "0 0 24 24",
            }));

        setLibraryMatches(matches);
        setSelectedLibraryMatch(null); // Reset selection when prompt changes
    }, [prompt, globalIcons]);

    // P2: Search Iconify when concept changes (debounced)
    useEffect(() => {
        if (!prompt.trim() || prompt.length < 2) {
            setIconifyMatches([]);
            return;
        }

        const timeoutId = setTimeout(async () => {
            setIsSearchingIconify(true);
            try {
                // Use the search API endpoint
                const response = await fetch(`/api/iconify/search?query=${encodeURIComponent(prompt.trim())}&limit=6`);
                if (response.ok) {
                    const data = await response.json();
                    setIconifyMatches(data.results || []);
                }
            } catch (error) {
                console.error("[P2] Iconify search failed:", error);
            } finally {
                setIsSearchingIconify(false);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
    }, [prompt]);

    // P3b: Use an existing icon from user's library
    const handleUseLibraryIcon = useCallback((match: LibraryMatch) => {
        if (!currentProject) {
            toast.error("No workspace available");
            return;
        }

        // Find the full icon data
        const fullIcon = globalIcons.find(i => i.id === match.id);
        if (!fullIcon) {
            toast.error("Icon not found");
            return;
        }

        // Check if already in favorites
        if (currentProject.favorites.includes(match.id)) {
            toast.info(`"${match.name}" is already in your favorites`);
            onClose();
            return;
        }

        // Add to favorites
        addIconToProject(fullIcon, true);
        toast.success(`"${match.name}" added to favorites!`);
        onClose();
    }, [currentProject, globalIcons, addIconToProject, onClose]);

    // P2: Import and adapt an icon from Iconify
    const handleImportAndAdapt = useCallback(async (match: IconifyMatch) => {
        if (!effectiveLibrary || !currentProject) {
            toast.error("No library available for style adaptation");
            return;
        }

        setIsImporting(true);
        try {
            // Get the styleManifest for the target library
            const librarySource = iconSources.find(s => s.name === effectiveLibrary);
            const styleManifest = librarySource?.styleManifest;

            // Call adaptation API
            const response = await fetch("/api/iconify/adapt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    iconId: match.iconId,
                    svg: match.svg,
                    targetLibrary: effectiveLibrary,
                    styleManifest,
                }),
            });

            if (!response.ok) {
                throw new Error("Adaptation failed");
            }

            const { adaptedSvg, path, viewBox } = await response.json();

            // Extract concept name from iconId (e.g., "lucide:bike" -> "bike")
            const conceptName = match.iconId.split(":")[1] || prompt || "imported-icon";

            // Save to workspace
            const newIcon = {
                id: crypto.randomUUID(),
                name: conceptName,
                library: "custom",
                viewBox: viewBox || "0 0 24 24",
                path: path,
                tags: ["imported", "adapted", match.collection],
                categories: ["Imported"],
                renderStyle: "stroke" as const,
            };

            addIconToProject(newIcon, true); // Auto-favorite
            toast.success(`"${conceptName}" imported and adapted!`);
            onClose();
        } catch (error) {
            console.error("[P2] Import failed:", error);
            toast.error("Failed to import icon");
        } finally {
            setIsImporting(false);
        }
    }, [effectiveLibrary, currentProject, iconSources, prompt, addIconToProject, onClose]);

    // F5: Plan kitbash assembly
    const handlePlanKitbash = useCallback(async () => {
        if (!prompt.trim()) {
            toast.error("Please enter an icon concept");
            return;
        }

        if (!effectiveLibrary) {
            toast.error("No icon library available");
            return;
        }

        // Get API key from localStorage (user's System Settings)
        const apiKey = localStorage.getItem("gemini_api_key");
        if (!apiKey) {
            toast.error("Please set your Google API key in System Settings");
            return;
        }

        // Get icons for the effective library
        const libraryIcons = globalIcons.filter(icon =>
            icon.library === effectiveLibrary && icon.path
        );

        if (libraryIcons.length < 5) {
            toast.error(`Not enough icons in "${effectiveLibrary}" library for kitbash.`);
            return;
        }

        setIsPlanning(true);
        setKitbashPlan(null);
        setKitbashSvg(null);
        setSelectedLayoutIndex(0);

        try {
            // Get styleManifest for the library
            const librarySource = iconSources.find(s => s.name === effectiveLibrary);
            const styleManifest = librarySource?.styleManifest;

            const response = await fetch("/api/kitbash", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: "plan",
                    concept: prompt.trim(),
                    icons: libraryIcons.slice(0, 50), // Send icons with components
                    styleManifest,
                    apiKey, // Pass user's API key from System Settings
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.details || error.error || "Planning failed");
            }

            const data = await response.json();
            setKitbashPlan(data.plan);

            if (data.plan.strategy === 'generate') {
                toast.info("No matching components found. Consider using Generate mode instead.");
            } else {
                toast.success(`Found ${data.plan.foundParts.length}/${data.plan.requiredParts.length} components (${Math.round(data.plan.coverage * 100)}% coverage)`);
            }
        } catch (error) {
            console.error("[F5] Kitbash planning failed:", error);
            toast.error(error instanceof Error ? error.message : "Planning failed");
        } finally {
            setIsPlanning(false);
        }
    }, [prompt, effectiveLibrary, globalIcons, iconSources]);

    // F5: Execute kitbash with selected layout
    const handleExecuteKitbash = useCallback(async () => {
        if (!kitbashPlan) {
            toast.error("No plan available");
            return;
        }

        if (!effectiveLibrary) {
            toast.error("No library available");
            return;
        }

        // Get API key from localStorage (user's System Settings)
        const apiKey = localStorage.getItem("gemini_api_key");
        if (!apiKey) {
            toast.error("Please set your Google API key in System Settings");
            return;
        }

        const libraryIcons = globalIcons.filter(icon =>
            icon.library === effectiveLibrary && icon.path
        );

        setIsExecutingKitbash(true);
        setKitbashSvg(null);

        try {
            const librarySource = iconSources.find(s => s.name === effectiveLibrary);
            const styleManifest = librarySource?.styleManifest;

            const response = await fetch("/api/kitbash", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: "execute",
                    concept: prompt.trim(),
                    icons: libraryIcons.slice(0, 50),
                    plan: kitbashPlan,
                    layoutIndex: selectedLayoutIndex,
                    styleManifest,
                    apiKey, // Pass user's API key from System Settings
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.details || error.error || "Execution failed");
            }

            const data = await response.json();
            setKitbashSvg(data.svg);

            if (data.usedGeneration) {
                toast.success(`Assembled icon with ${data.generatedParts?.length || 0} AI-generated parts`);
            } else {
                toast.success("Icon assembled from library components!");
            }
        } catch (error) {
            console.error("[F5] Kitbash execution failed:", error);
            toast.error(error instanceof Error ? error.message : "Assembly failed");
        } finally {
            setIsExecutingKitbash(false);
        }
    }, [kitbashPlan, effectiveLibrary, globalIcons, iconSources, prompt, selectedLayoutIndex]);

    // F5: Save kitbash result
    const handleSaveKitbash = useCallback(async () => {
        if (!kitbashSvg || !currentProject) return;

        setIsSaving(true);
        try {
            // Use extractCombinedPathData to convert ALL SVG elements to path data
            const { pathData, viewBox, fillRule } = extractCombinedPathData(kitbashSvg);

            if (!pathData) {
                throw new Error("Could not extract path from kitbash SVG");
            }

            // Check if SVG has transforms (kitbashed icons use <g transform="...">)
            const hasTransforms = kitbashSvg.includes('<g transform="');

            // Extract inner SVG content (everything between <svg> and </svg>)
            // This preserves transforms for complex assembled icons
            const innerMatch = kitbashSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
            const svgContent = hasTransforms && innerMatch ? innerMatch[1].trim() : undefined;

            console.log(`[Kitbash Save] hasTransforms: ${hasTransforms}, svgContent: ${svgContent ? 'yes' : 'no'}`);

            const newIcon = {
                id: crypto.randomUUID(),
                name: prompt || "Kitbashed Icon",
                library: "custom",
                viewBox,
                path: pathData,
                // For kitbashed icons with transforms, store the full SVG content
                svgContent,
                tags: ["ai-generated", "kitbash", "sprout"],
                categories: ["Generated"],
                renderStyle: "stroke" as const,
                fillRule,
            };

            addIconToProject(newIcon, true);
            toast.success(`"${prompt}" saved to workspace!`);
            onClose();
        } catch (error) {
            console.error('[F5] Save error:', error);
            toast.error(error instanceof Error ? error.message : "Failed to save icon");
        } finally {
            setIsSaving(false);
        }
    }, [kitbashSvg, currentProject, prompt, addIconToProject, onClose]);

    // Refinery: Polish a kitbash assembly into a cohesive icon
    const handleRefineKitbash = useCallback(async () => {
        if (!kitbashSvg) {
            toast.error("No assembly to refine");
            return;
        }

        // Get API key from localStorage (user's System Settings)
        const apiKey = localStorage.getItem("gemini_api_key");
        if (!apiKey) {
            toast.error("Please set your Google API key in System Settings");
            return;
        }

        // Get styleManifest for the library
        const librarySource = iconSources.find(s => s.name === effectiveLibrary);
        const styleManifest = librarySource?.styleManifest;

        setIsRefining(true);
        setRefinedSvg(null);
        setRefinementChanges([]);

        try {
            const response = await fetch("/api/kitbash", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mode: "refine",
                    concept: prompt.trim(),
                    draftSvg: kitbashSvg,
                    styleManifest,
                    apiKey,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.details || error.error || "Refinement failed");
            }

            const data = await response.json();

            if (data.success) {
                setRefinedSvg(data.svg);
                setRefinementChanges(data.changes || []);
                setShowRefinedView(true);
                toast.success("Icon refined successfully!");
            } else {
                toast.warning("Refinement returned original - no changes needed");
                setRefinedSvg(kitbashSvg);
                setRefinementChanges(data.changes || ["No changes applied"]);
            }
        } catch (error) {
            console.error("[Refinery] Refinement failed:", error);
            toast.error(error instanceof Error ? error.message : "Refinement failed");
        } finally {
            setIsRefining(false);
        }
    }, [kitbashSvg, prompt, effectiveLibrary, iconSources]);

    // Refinery: Save the refined version
    const handleSaveRefined = useCallback(async () => {
        const svgToSave = refinedSvg || kitbashSvg;
        if (!svgToSave || !currentProject) return;

        setIsSaving(true);
        try {
            // Use extractCombinedPathData to convert ALL SVG elements to path data
            const { pathData, viewBox, fillRule } = extractCombinedPathData(svgToSave);

            if (!pathData) {
                throw new Error("Could not extract path from refined SVG");
            }

            const newIcon = {
                id: crypto.randomUUID(),
                name: prompt || "Kitbashed Icon",
                library: "custom",
                viewBox,
                path: pathData,
                tags: ["ai-generated", "kitbash", "refined", "sprout"],
                categories: ["Generated"],
                renderStyle: "stroke" as const,
                fillRule,
            };

            addIconToProject(newIcon, true);
            toast.success(`"${prompt}" saved to workspace!`);
            onClose();
        } catch (error) {
            console.error('[Refinery] Save error:', error);
            toast.error(error instanceof Error ? error.message : "Failed to save icon");
        } finally {
            setIsSaving(false);
        }
    }, [refinedSvg, kitbashSvg, currentProject, prompt, addIconToProject, onClose]);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error("Please enter an icon concept");
            return;
        }

        if (!effectiveLibrary) {
            toast.error("No icon library available. Please ingest a library first.");
            return;
        }

        // Get API key from localStorage (user's System Settings)
        const apiKey = localStorage.getItem("gemini_api_key");
        if (!apiKey) {
            toast.error("Please set your Google API key in System Settings");
            return;
        }

        // Get icons for the effective library
        const libraryIcons = globalIcons.filter(icon =>
            icon.library === effectiveLibrary && icon.path
        );

        if (libraryIcons.length < 10) {
            toast.error(`Not enough icons in "${effectiveLibrary}" library. Need at least 10 icons.`);
            return;
        }

        setIsGenerating(true);
        setGeneratedSvgs([]);
        setSelectedSvgIndex(null);
        setMetadata(null);
        setCompliance(null); // F2: Reset compliance

        // F2: Select random ghost neighbors from the effective library
        const libIcons = globalIcons.filter(i => i.library === effectiveLibrary && i.path);
        if (libIcons.length >= 2) {
            const shuffled = [...libIcons].sort(() => Math.random() - 0.5);
            setGhostNeighbors({
                left: {
                    id: shuffled[0].id,
                    name: shuffled[0].name,
                    library: shuffled[0].library || 'custom',
                    path: shuffled[0].path || '',
                    viewBox: shuffled[0].viewBox || '0 0 24 24',
                },
                right: {
                    id: shuffled[1].id,
                    name: shuffled[1].name,
                    library: shuffled[1].library || 'custom',
                    path: shuffled[1].path || '',
                    viewBox: shuffled[1].viewBox || '0 0 24 24',
                },
            });
        }

        try {
            // Find the styleManifest for this library from icon sources
            const librarySource = iconSources.find(s => s.name === effectiveLibrary);
            const styleManifest = librarySource?.styleManifest;

            console.log(`[Modal] Generating "${prompt}" in style of ${effectiveLibrary} (${libraryIcons.length} icons)${styleManifest ? ' with Style DNA' : ''}`);

            const response = await fetch("/api/generate-svg", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    concept: prompt.trim(),
                    libraryId: effectiveLibrary,
                    icons: libraryIcons.slice(0, 100), // Send up to 100 icons for reference
                    styleManifest, // Pass Style DNA if available
                    apiKey, // Pass user's API key from System Settings
                    options: {
                        variants: variantCount,
                        fewShotCount,
                        temperature,
                        decompositionMode: "auto",
                        includePatternLibrary: true,
                    },
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();

                if (response.status === 429) {
                    throw new Error("API Quota Exceeded. Please wait a moment and try again.");
                }

                throw new Error(errorData.details || errorData.error || "Generation failed");
            }

            const data = await response.json();

            // Handle single or multiple SVGs
            const svgs = data.svgs || (data.svg ? [data.svg] : []);
            setGeneratedSvgs(svgs);
            setMetadata(data.metadata);

            // F2: Capture compliance data
            // Handle both single compliance object and array (variants mode)
            if (data.compliance) {
                // If it's an array (variants mode), use the first one; if single, use as-is
                const complianceData = Array.isArray(data.compliance)
                    ? data.compliance[0]
                    : data.compliance;
                // Ensure violations array exists (variants mode only has violationCount)
                if (complianceData && !complianceData.violations) {
                    complianceData.violations = [];
                }
                setCompliance(complianceData);
            }

            if (svgs.length > 0) {
                toast.success(`Generated ${svgs.length} icon variant${svgs.length > 1 ? 's' : ''}!`);
            } else {
                toast.error("No icons were generated");
            }
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "Failed to generate icons");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        if (selectedSvgIndex === null || !currentProject) return;

        setIsSaving(true);
        try {
            const svg = generatedSvgs[selectedSvgIndex];

            // Use extractCombinedPathData to convert ALL SVG elements to path data
            // This handles paths, circles, rects, lines, polylines, polygons, ellipses
            const { pathData, viewBox, fillRule } = extractCombinedPathData(svg);

            if (!pathData) {
                throw new Error("Could not extract vector path from generated SVG");
            }

            // Check if SVG has transforms (kitbashed icons use <g transform="...">)
            const hasTransforms = svg.includes('<g transform="');

            // Extract inner SVG content for transforms preservation
            const innerMatch = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
            const svgContent = hasTransforms && innerMatch ? innerMatch[1].trim() : undefined;

            console.log(`[Modal] Saving icon with path length: ${pathData.length}, hasTransforms: ${hasTransforms}`);

            const newIcon = {
                id: crypto.randomUUID(),
                name: prompt || "Generated Icon",
                library: "custom",
                viewBox,
                path: pathData,
                // For icons with transforms, store the full SVG content
                svgContent,
                tags: ["ai-generated", "sprout"],
                categories: ["Generated"],
                renderStyle: "stroke" as const,
                fillRule,
            };

            addIconToProject(newIcon, true); // Auto-favorite
            toast.success(`"${prompt}" saved to workspace!`);
            onClose();
        } catch (error) {
            console.error('Save error:', error);
            toast.error(error instanceof Error ? error.message : "Failed to save icon");
        } finally {
            setIsSaving(false);
        }
    };

    // Helper to render SVG preview
    // Generated SVGs already have proper styling from the Style Enforcer
    // We only need to add sizing class and ensure currentColor for theming
    const renderSvgPreview = (svg: string) => {
        return svg
            .replace(/<svg/, '<svg class="w-full h-full"')
            // Replace stroke="..." with currentColor for theme support, but preserve fill styling
            .replace(/stroke="(?!none)[^"]*"/g, 'stroke="currentColor"');
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[1200px] w-[90vw] h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        Sprout Custom Icon
                    </DialogTitle>
                    <DialogDescription>
                        Generate native SVG icons that match your library&apos;s style.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex gap-6 min-h-0 py-4 overflow-hidden">
                    {/* Left Column: Controls */}
                    <div className="w-72 shrink-0 flex flex-col gap-4 overflow-y-auto">
                        <div className="space-y-2">
                            <Label>Icon Concept</Label>
                            <Input
                                placeholder="e.g. rocket, brain, magic-wand"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && !isGenerating && handleGenerate()}
                                disabled={isGenerating}
                            />
                            <p className="text-xs text-muted-foreground">
                                Describe the icon you want to create
                            </p>
                            {/* P3c: Related search terms */}
                            {relatedTerms.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    <span className="text-[10px] text-muted-foreground">Try:</span>
                                    {relatedTerms.slice(0, 4).map((term) => (
                                        <button
                                            key={term}
                                            type="button"
                                            onClick={() => setPrompt(term)}
                                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {term}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Style Library</Label>
                            {libraryOverride ? (
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 px-3 py-2 rounded-md border bg-muted/50 text-sm">
                                        {libraryOverride.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setLibraryOverride(null)}
                                        className="text-xs"
                                    >
                                        Reset
                                    </Button>
                                </div>
                            ) : detectedLibrary ? (
                                <div className="px-3 py-2 rounded-md border bg-muted/50">
                                    <div className="text-sm font-medium">
                                        {detectedLibrary.library.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {detectedLibrary.fromAll
                                            ? `Largest library (${detectedLibrary.count} icons)`
                                            : `Detected from ${detectedLibrary.count}/${detectedLibrary.total} favorites`}
                                    </div>
                                </div>
                            ) : (
                                <div className="px-3 py-2 rounded-md border bg-muted/50 text-sm text-muted-foreground">
                                    No library available
                                </div>
                            )}
                            {availableLibraries.length > 1 && !libraryOverride && (
                                <Select value="" onValueChange={(v) => v && setLibraryOverride(v)}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Override library..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableLibraries.map(lib => (
                                            <SelectItem key={lib} value={lib}>
                                                {lib.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* F5: Mode Selection */}
                        <div className="space-y-2">
                            <Label>Creation Mode</Label>
                            <Tabs value={generationMode} onValueChange={(v) => setGenerationMode(v as 'generate' | 'kitbash')} className="w-full">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="generate" className="text-xs">
                                        <Wand2 className="w-3 h-3 mr-1.5" />
                                        Generate
                                    </TabsTrigger>
                                    <TabsTrigger value="kitbash" className="text-xs">
                                        <Puzzle className="w-3 h-3 mr-1.5" />
                                        Kitbash
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <p className="text-[10px] text-muted-foreground">
                                {generationMode === 'generate'
                                    ? "AI generates new icon from scratch"
                                    : "Assemble from existing library components"}
                            </p>
                        </div>

                        {/* Generate mode options */}
                        {generationMode === 'generate' && (
                            <div className="space-y-2">
                                <Label>Variants</Label>
                                <Select value={variantCount.toString()} onValueChange={(v) => setVariantCount(parseInt(v))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">1 variant</SelectItem>
                                        <SelectItem value="2">2 variants</SelectItem>
                                        <SelectItem value="3">3 variants</SelectItem>
                                        <SelectItem value="4">4 variants</SelectItem>
                                        <SelectItem value="5">5 variants</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Advanced Options Toggle (Generate mode only) */}
                        {generationMode === 'generate' && (
                            <div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-xs text-muted-foreground"
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                >
                                    <Settings2 className="w-3 h-3 mr-2" />
                                    {showAdvanced ? "Hide" : "Show"} Advanced Options
                                </Button>
                                {showAdvanced && (
                                    <div className="space-y-3 pt-2 px-1">
                                        <div className="space-y-1">
                                            <Label className="text-xs flex justify-between">
                                                <span>Few-shot Examples</span>
                                                <span className="text-muted-foreground">{fewShotCount}</span>
                                            </Label>
                                            <input
                                                type="range"
                                                min="1"
                                                max="8"
                                                step="1"
                                                value={fewShotCount}
                                                onChange={(e) => setFewShotCount(Number(e.target.value))}
                                                className="w-full h-2"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs flex justify-between">
                                                <span>Temperature</span>
                                                <span className="text-muted-foreground">{temperature.toFixed(1)}</span>
                                            </Label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={temperature}
                                                onChange={(e) => setTemperature(Number(e.target.value))}
                                                className="w-full h-2"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-auto">
                            {generationMode === 'generate' ? (
                                <Button
                                    className="w-full"
                                    onClick={handleGenerate}
                                    disabled={!prompt.trim() || isGenerating || globalIcons.length < 10}
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Generate Icon
                                        </>
                                    )}
                                </Button>
                            ) : (
                                <Button
                                    className="w-full"
                                    onClick={handlePlanKitbash}
                                    disabled={!prompt.trim() || isPlanning || globalIcons.length < 5}
                                >
                                    {isPlanning ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Planning...
                                        </>
                                    ) : (
                                        <>
                                            <Puzzle className="w-4 h-4 mr-2" />
                                            Plan Assembly
                                        </>
                                    )}
                                </Button>
                            )}
                            {globalIcons.length < 10 && (
                                <p className="text-xs text-destructive mt-2 text-center">
                                    Ingest an icon library first to enable generation
                                </p>
                            )}
                        </div>
                    </div>

                    <Separator orientation="vertical" />

                    {/* Right Column: Results */}
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* P3b: Already in your library */}
                        {libraryMatches.length > 0 && (
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Library className="w-4 h-4 text-green-600" />
                                    <Label className="text-sm text-green-700">Already in your library</Label>
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {libraryMatches.map((match) => (
                                        <button
                                            key={match.id}
                                            className={cn(
                                                "relative flex-shrink-0 w-16 h-16 rounded-lg border-2 bg-background p-2 transition-all hover:border-green-500/50 focus:outline-none group",
                                                selectedLibraryMatch?.id === match.id
                                                    ? "border-green-500 ring-2 ring-green-500/20"
                                                    : "border-muted"
                                            )}
                                            onClick={() => setSelectedLibraryMatch(
                                                selectedLibraryMatch?.id === match.id ? null : match
                                            )}
                                            title={`${match.library}: ${match.name}`}
                                        >
                                            <svg
                                                viewBox={match.viewBox}
                                                className="w-full h-full text-foreground"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d={match.path} />
                                            </svg>
                                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground bg-background px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                {match.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                {selectedLibraryMatch && (
                                    <Button
                                        size="sm"
                                        variant="default"
                                        className="w-full mt-2 bg-green-600 hover:bg-green-700"
                                        onClick={() => handleUseLibraryIcon(selectedLibraryMatch)}
                                    >
                                        <Check className="w-3 h-3 mr-2" />
                                        Use &quot;{selectedLibraryMatch.name}&quot; from {selectedLibraryMatch.library}
                                    </Button>
                                )}
                                <Separator className="mt-3" />
                            </div>
                        )}

                        {/* P2: Found in other libraries */}
                        {(iconifyMatches.length > 0 || isSearchingIconify) && (
                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Globe className="w-4 h-4 text-muted-foreground" />
                                    <Label className="text-sm">Found in other libraries</Label>
                                    {isSearchingIconify && (
                                        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                    )}
                                </div>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {iconifyMatches.map((match) => (
                                        <button
                                            key={match.iconId}
                                            className={cn(
                                                "relative flex-shrink-0 w-16 h-16 rounded-lg border-2 bg-background p-2 transition-all hover:border-primary/50 focus:outline-none group",
                                                selectedIconifyMatch?.iconId === match.iconId
                                                    ? "border-primary ring-2 ring-primary/20"
                                                    : "border-muted"
                                            )}
                                            onClick={() => setSelectedIconifyMatch(
                                                selectedIconifyMatch?.iconId === match.iconId ? null : match
                                            )}
                                            title={`${match.collection}: ${match.iconId.split(':')[1]}`}
                                        >
                                            <div
                                                className="w-full h-full text-foreground"
                                                dangerouslySetInnerHTML={{
                                                    __html: match.svg
                                                        .replace(/<svg/, '<svg class="w-full h-full"')
                                                        .replace(/stroke="[^"]*"/, 'stroke="currentColor"')
                                                }}
                                            />
                                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground bg-background px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                {match.collection}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                {selectedIconifyMatch && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="w-full mt-2"
                                        onClick={() => handleImportAndAdapt(selectedIconifyMatch)}
                                        disabled={isImporting}
                                    >
                                        {isImporting ? (
                                            <>
                                                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                                Importing...
                                            </>
                                        ) : (
                                            <>
                                                <Import className="w-3 h-3 mr-2" />
                                                Import &amp; Adapt from {selectedIconifyMatch.collection}
                                            </>
                                        )}
                                    </Button>
                                )}
                                <Separator className="mt-3" />
                            </div>
                        )}

                        {/* F5: Kitbash Plan Results */}
                        {generationMode === 'kitbash' && kitbashPlan && (
                            <div className="mb-4 p-3 rounded-lg border bg-muted/30">
                                {/* Strategy & Coverage Header */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Puzzle className="w-4 h-4 text-primary" />
                                        <span className="text-sm font-medium">Assembly Plan</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "text-xs px-2 py-0.5 rounded-full font-medium uppercase",
                                            kitbashPlan.strategy === 'graft' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                                            kitbashPlan.strategy === 'hybrid' && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                                            kitbashPlan.strategy === 'adapt' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                                            kitbashPlan.strategy === 'generate' && "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
                                        )}>
                                            {kitbashPlan.strategy}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {Math.round(kitbashPlan.coverage * 100)}% coverage
                                        </span>
                                    </div>
                                </div>

                                {/* Found & Missing Parts */}
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                        <Label className="text-[10px] text-muted-foreground mb-1 block">Found Parts</Label>
                                        <div className="space-y-1">
                                            {kitbashPlan.foundParts.length > 0 ? (
                                                kitbashPlan.foundParts.map((part, i) => (
                                                    <div key={i} className="flex items-center gap-1 text-xs">
                                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                        <span className="truncate" title={`From: ${part.sourceIcon}`}>{part.partName}</span>
                                                        <span className="text-[9px] text-muted-foreground" title={`From ${part.sourceIcon}`}>
                                                            ({part.sourceIcon.split('-')[0]})
                                                        </span>
                                                    </div>
                                                ))
                                            ) : (
                                                <span className="text-xs text-muted-foreground">None</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-[10px] text-muted-foreground mb-1 block">Missing Parts</Label>
                                        <div className="space-y-1">
                                            {kitbashPlan.missingParts.length > 0 ? (
                                                kitbashPlan.missingParts.map((part, i) => (
                                                    <div key={i} className="flex items-center gap-1 text-xs">
                                                        <AlertCircle className="w-3 h-3 text-yellow-500" />
                                                        <span className="truncate">{part}</span>
                                                        <span className="text-[9px] text-muted-foreground">(AI)</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <span className="text-xs text-green-600">All parts found!</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Layout Selection */}
                                {kitbashPlan.suggestedLayouts.length > 0 && (
                                    <div className="mb-3">
                                        <Label className="text-[10px] text-muted-foreground mb-2 block">Select Layout</Label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {kitbashPlan.suggestedLayouts.map((layout, index) => (
                                                <button
                                                    key={layout.name}
                                                    onClick={() => setSelectedLayoutIndex(index)}
                                                    className={cn(
                                                        "p-2 rounded-md border text-left transition-all",
                                                        selectedLayoutIndex === index
                                                            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                                            : "border-muted hover:border-muted-foreground/30"
                                                    )}
                                                >
                                                    <div className="text-[10px] font-medium truncate">
                                                        {layout.name.replace(/_/g, ' ')}
                                                    </div>
                                                    <div className="text-[9px] text-muted-foreground line-clamp-2 mt-0.5">
                                                        {layout.description}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Execute Button */}
                                <Button
                                    className="w-full"
                                    onClick={handleExecuteKitbash}
                                    disabled={isExecutingKitbash || kitbashPlan.strategy === 'generate'}
                                >
                                    {isExecutingKitbash ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Assembling...
                                        </>
                                    ) : (
                                        <>
                                            <ChevronRight className="w-4 h-4 mr-2" />
                                            Assemble Icon
                                        </>
                                    )}
                                </Button>

                                {kitbashPlan.strategy === 'generate' && (
                                    <p className="text-[10px] text-muted-foreground text-center mt-2">
                                        No components found. Switch to Generate mode for this concept.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* F5: Kitbash Result Preview with Refinery */}
                        {generationMode === 'kitbash' && kitbashSvg && (
                            <div className={cn(
                                "mb-4 p-4 rounded-lg border-2",
                                refinedSvg
                                    ? "border-purple-500/50 bg-purple-50/50 dark:bg-purple-900/10"
                                    : "border-green-500/50 bg-green-50/50 dark:bg-green-900/10"
                            )}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className={cn(
                                            "w-5 h-5",
                                            refinedSvg ? "text-purple-500" : "text-green-500"
                                        )} />
                                        <span className={cn(
                                            "text-sm font-medium",
                                            refinedSvg
                                                ? "text-purple-700 dark:text-purple-400"
                                                : "text-green-700 dark:text-green-400"
                                        )}>
                                            {refinedSvg ? "Icon Refined!" : "Icon Assembled!"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Refine button - only show if not yet refined */}
                                        {!refinedSvg && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleRefineKitbash}
                                                disabled={isRefining}
                                                className="border-purple-300 hover:bg-purple-50 dark:border-purple-700 dark:hover:bg-purple-900/20"
                                            >
                                                {isRefining ? (
                                                    <>
                                                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                                                        Refining...
                                                    </>
                                                ) : (
                                                    <>
                                                        <RefreshCw className="w-3 h-3 mr-1.5" />
                                                        Refine
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            onClick={refinedSvg ? handleSaveRefined : handleSaveKitbash}
                                            disabled={isSaving}
                                            className={refinedSvg ? "bg-purple-600 hover:bg-purple-700" : "bg-green-600 hover:bg-green-700"}
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <Download className="w-3 h-3 mr-1.5" />
                                                    Save to Workspace
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {/* Draft/Refined toggle when refined version exists */}
                                {refinedSvg && (
                                    <div className="flex justify-center gap-2 mb-3">
                                        <button
                                            onClick={() => setShowRefinedView(false)}
                                            className={cn(
                                                "text-xs px-3 py-1 rounded-full transition-colors",
                                                !showRefinedView
                                                    ? "bg-muted text-foreground"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            Draft
                                        </button>
                                        <button
                                            onClick={() => setShowRefinedView(true)}
                                            className={cn(
                                                "text-xs px-3 py-1 rounded-full transition-colors",
                                                showRefinedView
                                                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            Refined
                                        </button>
                                    </div>
                                )}

                                <div className="flex justify-center">
                                    <div className={cn(
                                        "w-28 h-28 p-3 rounded-lg border-2 bg-background shadow-sm",
                                        refinedSvg && showRefinedView ? "border-purple-500" : "border-green-500"
                                    )}>
                                        <div
                                            className="w-full h-full text-foreground"
                                            dangerouslySetInnerHTML={{
                                                __html: renderSvgPreview(
                                                    refinedSvg && showRefinedView ? refinedSvg : kitbashSvg
                                                )
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Refinement changes */}
                                {refinedSvg && refinementChanges.length > 0 && showRefinedView && (
                                    <div className="mt-3 pt-2 border-t border-purple-200 dark:border-purple-800">
                                        <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mb-1">
                                            Refinement applied:
                                        </p>
                                        <ul className="text-[10px] text-muted-foreground space-y-0.5">
                                            {refinementChanges.slice(0, 4).map((change, i) => (
                                                <li key={i} className="flex items-center gap-1">
                                                    <CheckCircle2 className="w-2.5 h-2.5 text-purple-500" />
                                                    {change}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <p className="text-xs text-center text-muted-foreground mt-2">
                                    &quot;{prompt}&quot; ready to add to your workspace
                                    {!refinedSvg && (
                                        <span className="block text-[10px] mt-1">
                                            Tip: Click &quot;Refine&quot; to smooth overlapping paths
                                        </span>
                                    )}
                                </p>
                            </div>
                        )}

                        {/* F2: Ghost Preview - Show selected icon in context */}
                        {selectedSvgIndex !== null && ghostNeighbors.left && ghostNeighbors.right && (
                            <div className="mb-4 p-3 rounded-lg border bg-muted/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-medium text-muted-foreground">Context Preview</span>
                                    {compliance && (
                                        <span className={cn(
                                            "text-xs px-2 py-0.5 rounded-full",
                                            compliance.passed
                                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                        )}>
                                            Score: {compliance.score}/100
                                        </span>
                                    )}
                                </div>

                                {/* Three icons in a row: neighbor - candidate - neighbor */}
                                <div className="flex items-center justify-center gap-4">
                                    {/* Left neighbor */}
                                    <div className="flex flex-col items-center">
                                        <div className="w-14 h-14 p-2 rounded-lg border bg-background">
                                            <svg
                                                viewBox={ghostNeighbors.left.viewBox}
                                                className="w-full h-full text-muted-foreground"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d={ghostNeighbors.left.path} />
                                            </svg>
                                        </div>
                                        <span className="text-[9px] text-muted-foreground mt-1 truncate max-w-[60px]">
                                            {ghostNeighbors.left.name}
                                        </span>
                                    </div>

                                    {/* Candidate (generated) */}
                                    <div className="flex flex-col items-center">
                                        <div className="w-16 h-16 p-2 rounded-lg border-2 border-primary bg-background ring-2 ring-primary/20">
                                            <div
                                                className="w-full h-full text-foreground"
                                                dangerouslySetInnerHTML={{ __html: renderSvgPreview(generatedSvgs[selectedSvgIndex]) }}
                                            />
                                        </div>
                                        <span className="text-[9px] font-medium text-primary mt-1">
                                            {prompt || 'Generated'}
                                        </span>
                                    </div>

                                    {/* Right neighbor */}
                                    <div className="flex flex-col items-center">
                                        <div className="w-14 h-14 p-2 rounded-lg border bg-background">
                                            <svg
                                                viewBox={ghostNeighbors.right.viewBox}
                                                className="w-full h-full text-muted-foreground"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d={ghostNeighbors.right.path} />
                                            </svg>
                                        </div>
                                        <span className="text-[9px] text-muted-foreground mt-1 truncate max-w-[60px]">
                                            {ghostNeighbors.right.name}
                                        </span>
                                    </div>
                                </div>

                                {/* Compliance details */}
                                {compliance && compliance.violations && compliance.violations.length > 0 && (
                                    <div className="mt-3 pt-2 border-t space-y-1">
                                        {compliance.violations.slice(0, 3).map((v, i) => (
                                            <div key={i} className="flex items-center gap-2 text-[10px]">
                                                {v.severity === 'error' ? (
                                                    v.autoFixed ? (
                                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                    ) : (
                                                        <AlertCircle className="w-3 h-3 text-red-500" />
                                                    )
                                                ) : (
                                                    <AlertTriangle className="w-3 h-3 text-yellow-500" />
                                                )}
                                                <span className="text-muted-foreground">
                                                    {v.rule}: {v.autoFixed ? 'fixed' : `${v.actual} → ${v.expected}`}
                                                </span>
                                            </div>
                                        ))}
                                        {compliance.changesApplied > 0 && (
                                            <div className="text-[10px] text-green-600 dark:text-green-400">
                                                ✓ {compliance.changesApplied} style {compliance.changesApplied === 1 ? 'fix' : 'fixes'} auto-applied
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-between mb-2">
                            <Label>Generated Icons</Label>
                            {metadata && (
                                <span className="text-xs text-muted-foreground">
                                    {metadata.fewShotExamples?.length || 0} examples used
                                    {metadata.decompositionSource && ` · ${metadata.decompositionSource} decomposition`}
                                </span>
                            )}
                        </div>
                        <ScrollArea className="flex-1 bg-muted/30 rounded-lg border p-4">
                            {generatedSvgs.length > 0 ? (
                                <div className="grid grid-cols-3 gap-4">
                                    {generatedSvgs.map((svg, index) => (
                                        <button
                                            key={index}
                                            className={cn(
                                                "relative aspect-square rounded-lg border-2 overflow-hidden bg-background transition-all hover:border-primary/50 focus:outline-none p-4",
                                                selectedSvgIndex === index ? "border-primary ring-2 ring-primary/20" : "border-muted"
                                            )}
                                            onClick={() => setSelectedSvgIndex(index)}
                                        >
                                            <div
                                                className="w-full h-full text-foreground"
                                                dangerouslySetInnerHTML={{ __html: renderSvgPreview(svg) }}
                                            />
                                            {selectedSvgIndex === index && (
                                                <div className="absolute top-2 right-2 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-sm">
                                                    <Check className="w-3 h-3" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center p-8">
                                    <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                                    <p className="text-sm font-medium">Ready to generate</p>
                                    <p className="text-xs mt-1">Enter a concept and click generate to create icons.</p>
                                </div>
                            )}
                        </ScrollArea>

                        <div className="mt-4 flex justify-end gap-2">
                            <Button variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            {generationMode === 'generate' ? (
                                <Button
                                    onClick={handleSave}
                                    disabled={selectedSvgIndex === null || isSaving}
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-4 h-4 mr-2" />
                                            Save to Workspace
                                        </>
                                    )}
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleSaveKitbash}
                                    disabled={!kitbashSvg || isSaving}
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-4 h-4 mr-2" />
                                            Save to Workspace
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
