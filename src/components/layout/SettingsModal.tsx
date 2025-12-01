"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useSearch } from "@/lib/search-context";
import { useProject } from "@/lib/project-context";
import { ingestGitHubRepo } from "@/lib/ingestion-service";

import { getIngestedIcons, saveIngestedIcons, clearIngestedIcons, getIconSources, saveIconSources } from "@/lib/storage";
import { Icon } from "@/types/schema";
import { Sparkles, Key, Loader2, Github, Trash2, AlertTriangle, Wand2, RefreshCw, Globe, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { analyzeLibrary } from "@/app/actions/analyze-library";

interface SettingsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface Source {
    id: string;
    name: string;
    url: string;
    path: string;
    count: number;
    styleManifest?: string;
}

// Fun status messages for enrichment process
const ENRICHMENT_MESSAGES = [
    "Measuring stroke widths...",
    "Analyzing geometric complexity...",
    "Cataloging visual symmetry...",
    "Detecting containment patterns...",
    "Classifying semantic intent...",
    "Extracting corner radii...",
    "Mapping path intersections...",
    "Profiling visual weight...",
    "Identifying compound shapes...",
    "Indexing semantic tags...",
    "Measuring negative space...",
    "Calculating complexity scores...",
    "Discovering visual patterns...",
    "Labeling component anatomy...",
    "Building kitbash inventory...",
    "Cross-referencing traits...",
];

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
    const { icons, setIcons } = useSearch();
    const { currentProject } = useProject();
    const [apiKey, setApiKey] = useState("");
    const [enriching, setEnriching] = useState(false);
    const [enrichProgress, setEnrichProgress] = useState(0);
    const [enrichTarget, setEnrichTarget] = useState<"all" | "missing" | "favorites">("missing");
    const [enrichStatusIndex, setEnrichStatusIndex] = useState(0);

    // Library ingestion state
    const [ingesting, setIngesting] = useState(false);
    const [ingestProgress, setIngestProgress] = useState("");
    const [repoUrl, setRepoUrl] = useState("");
    const [pathInRepo, setPathInRepo] = useState("");
    const [sources, setSources] = useState<Source[]>([]);
    const [useLegacyPrompt, setUseLegacyPrompt] = useState(false);

    // DNA Editor State
    const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
    const [editingManifest, setEditingManifest] = useState("");
    const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

    // Iconify Import State
    const [iconifySearch, setIconifySearch] = useState("");
    const [iconifyResults, setIconifyResults] = useState<Array<{
        prefix: string;
        name: string;
        total: number;
        license?: string;
    }>>([]);
    const [searchingIconify, setSearchingIconify] = useState(false);
    const [importingIconify, setImportingIconify] = useState<string | null>(null);
    const [iconifyImportProgress, setIconifyImportProgress] = useState("");

    // Calculate icon counts for enrichment options
    const allCount = icons.length;
    const missingCount = icons.filter(i => !i.aiDescription).length;
    const favoritesCount = currentProject?.favorites.length || 0;

    // Cycle through fun enrichment messages
    useEffect(() => {
        if (!enriching) return;
        const interval = setInterval(() => {
            setEnrichStatusIndex(prev => (prev + 1) % ENRICHMENT_MESSAGES.length);
        }, 1800); // Change message every 1.8 seconds
        return () => clearInterval(interval);
    }, [enriching]);

    // Load API key and sources from localStorage
    // Load API key and sources from localStorage/IndexedDB
    useEffect(() => {
        const storedKey = localStorage.getItem("gemini_api_key");
        if (storedKey) setApiKey(storedKey);

        async function loadSources() {
            let loadedSources = await getIconSources();

            // Migration: Check localStorage if IDB is empty
            if (loadedSources.length === 0) {
                const storedSources = localStorage.getItem("icon_sources");
                if (storedSources) {
                    try {
                        loadedSources = JSON.parse(storedSources);
                        await saveIconSources(loadedSources);
                        localStorage.removeItem("icon_sources");
                        console.log("Migrated icon_sources from localStorage to IndexedDB");
                    } catch (e) {
                        console.error("Failed to parse localStorage icon_sources", e);
                    }
                }
            }
            setSources(loadedSources);
        }
        loadSources();

        const storedLegacy = localStorage.getItem("use_legacy_prompt");
        if (storedLegacy) setUseLegacyPrompt(storedLegacy === "true");
    }, []);

    const handleToggleLegacyPrompt = (checked: boolean) => {
        setUseLegacyPrompt(checked);
        localStorage.setItem("use_legacy_prompt", String(checked));
    };

    const handleSaveApiKey = () => {
        localStorage.setItem("gemini_api_key", apiKey);
        alert("API Key saved successfully");
    };

    const handleIngestLibrary = async () => {
        if (!repoUrl || !pathInRepo) {
            alert("Please enter both GitHub URL and path");
            return;
        }

        setIngesting(true);
        setIngestProgress("Initializing...");

        try {
            if (!apiKey) {
                alert("Please enter your Gemini API Key first to generate Style DNA");
                // We continue, but DNA generation will be skipped/empty
            }

            const cleanRepoUrl = repoUrl.trim().replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, "");
            const cleanPath = pathInRepo.trim().replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, "");

            const { icons: newIcons, manifest } = await ingestGitHubRepo(
                cleanRepoUrl,
                cleanPath,
                apiKey,
                (current, total, status) => {
                    setIngestProgress(`${status} (${current}/${total})`);
                }
            );

            // Save icons
            const existingIcons = await getIngestedIcons();
            const merged = [...existingIcons, ...newIcons];
            await saveIngestedIcons(merged);
            setIcons(merged);

            // Extract repo name from URL
            const urlParts = repoUrl.replace("https://github.com/", "").split("/");
            const repoName = urlParts[1] || "unknown";

            // Save source metadata
            const newSource: Source = {
                id: Date.now().toString(),
                name: repoName,
                url: repoUrl,
                path: pathInRepo,
                count: newIcons.length,
                styleManifest: manifest
            };

            const updatedSources = [...sources, newSource];
            setSources(updatedSources);
            await saveIconSources(updatedSources);

            // Reset form
            setRepoUrl("");
            setPathInRepo("");

            alert(`Successfully ingested ${newIcons.length} icons from ${repoName}!`);
        } catch (error) {
            alert(`Failed to ingest library: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setIngesting(false);
            setIngestProgress("");
        }
    };

    const handleDeleteSource = async (sourceId: string) => {
        const source = sources.find(s => s.id === sourceId);
        if (!source) return;

        if (!confirm(`Delete library "${source.name}"? This will remove all ${source.count} icons from this library.`)) {
            return;
        }

        // Remove icons from this library
        const allIcons = await getIngestedIcons();
        const filtered = allIcons.filter((icon: Icon) => icon.library !== source.name);
        await saveIngestedIcons(filtered);
        setIcons(filtered);

        // Remove source
        const updatedSources = sources.filter(s => s.id !== sourceId);
        setSources(updatedSources);
        await saveIconSources(updatedSources);

        alert(`Deleted ${source.name} and removed ${source.count} icons`);
    };

    const handleClearAllData = async () => {
        if (!confirm("⚠️ Clear ALL ingested libraries and icons? This cannot be undone!")) {
            return;
        }

        await clearIngestedIcons();
        await clearIngestedIcons();
        await saveIconSources([]);
        setSources([]);
        setIcons([]);

        alert("All data cleared successfully");
    };

    const handleEditDNA = (source: Source) => {
        setEditingSourceId(source.id);
        setEditingManifest(source.styleManifest || "No DNA extracted yet.");
    };

    const handleSaveDNA = async () => {
        if (!editingSourceId) return;

        const updatedSources = sources.map(s => {
            if (s.id === editingSourceId) {
                return { ...s, styleManifest: editingManifest };
            }
            return s;
        });

        setSources(updatedSources);
        await saveIconSources(updatedSources);
        setEditingSourceId(null);
        setEditingManifest("");
    };

    const handleCancelEditDNA = () => {
        setEditingSourceId(null);
        setEditingManifest("");
    };

    const handleRegenerateDNA = async (source: Source) => {
        if (!apiKey) {
            alert("Please enter your Gemini API Key first");
            return;
        }

        setRegeneratingId(source.id);
        try {
            const allIcons = await getIngestedIcons();
            const libraryIcons = allIcons.filter((i: Icon) => i.library === source.name);

            if (libraryIcons.length === 0) {
                throw new Error("No icons found for this library");
            }

            const manifest = await analyzeLibrary(libraryIcons, apiKey);

            if (!manifest) {
                throw new Error("Failed to generate manifest");
            }

            const updatedSources = sources.map(s => {
                if (s.id === source.id) {
                    return { ...s, styleManifest: manifest };
                }
                return s;
            });

            setSources(updatedSources);
            await saveIconSources(updatedSources);

            // If currently editing this one, update the editor too
            if (editingSourceId === source.id) {
                setEditingManifest(manifest);
            }

            alert("Style DNA regenerated successfully!");
        } catch (error) {
            alert(`Failed to regenerate DNA: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setRegeneratingId(null);
        }
    };

    // Iconify handlers
    const handleSearchIconify = async () => {
        if (!iconifySearch.trim()) return;

        setSearchingIconify(true);
        try {
            const response = await fetch(`/api/iconify/collections?search=${encodeURIComponent(iconifySearch)}`);
            if (!response.ok) throw new Error("Search failed");
            const data = await response.json();
            setIconifyResults(data.collections || []);
        } catch (error) {
            console.error("Iconify search failed:", error);
            setIconifyResults([]);
        } finally {
            setSearchingIconify(false);
        }
    };

    const handleLoadPopularCollections = async () => {
        setSearchingIconify(true);
        try {
            const response = await fetch("/api/iconify/collections?popular=true");
            if (!response.ok) throw new Error("Failed to load collections");
            const data = await response.json();
            setIconifyResults(data.collections || []);
        } catch (error) {
            console.error("Failed to load popular collections:", error);
        } finally {
            setSearchingIconify(false);
        }
    };

    const handleImportIconifyCollection = async (prefix: string) => {
        console.log("[Iconify Import] Starting import for:", prefix);
        setImportingIconify(prefix);
        setIconifyImportProgress("Initializing...");

        try {
            const response = await fetch("/api/iconify/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prefix,
                    apiKey: apiKey || undefined,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Import failed");
            }

            // Handle streaming response
            const reader = response.body?.getReader();
            if (!reader) throw new Error("No response stream");

            const decoder = new TextDecoder();
            let importedIcons: Icon[] = [];
            let manifest = "";
            let collectionName = prefix;
            let buffer = ""; // Accumulate partial lines across chunks

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Append new chunk to buffer (stream: true handles partial UTF-8)
                buffer += decoder.decode(value, { stream: true });

                // Process complete lines (ending with \n)
                const lines = buffer.split("\n");
                // Keep the last partial line in buffer
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line);
                        if (event.status === "fetching") {
                            setIconifyImportProgress(`Fetching icons... (${event.progress}/${event.total})`);
                        } else if (event.status === "converting") {
                            setIconifyImportProgress(`Converting to Symbol Garden format...`);
                        } else if (event.status === "analyzing") {
                            setIconifyImportProgress(`Generating Style DNA...`);
                        } else if (event.status === "complete") {
                            importedIcons = event.icons || [];
                            manifest = event.manifest || "";
                            collectionName = event.name || prefix;
                        }
                    } catch (e) {
                        console.warn("[Iconify Import] Failed to parse line:", line.substring(0, 100), e);
                    }
                }
            }

            // Process any remaining data in buffer after stream ends
            if (buffer.trim()) {
                try {
                    const event = JSON.parse(buffer);
                    if (event.status === "complete") {
                        importedIcons = event.icons || [];
                        manifest = event.manifest || "";
                        collectionName = event.name || prefix;
                    }
                } catch (e) {
                    console.warn("[Iconify Import] Failed to parse final buffer:", buffer.substring(0, 100), e);
                }
            }

            if (importedIcons.length === 0) {
                throw new Error("No icons were imported");
            }

            // Save icons
            const existingIcons = await getIngestedIcons();
            const merged = [...existingIcons, ...importedIcons];
            await saveIngestedIcons(merged);
            setIcons(merged);

            // Save source metadata
            const newSource: Source = {
                id: `iconify-${prefix}-${Date.now()}`,
                name: collectionName,
                url: `https://iconify.design/icon-sets/${prefix}/`,
                path: `Iconify: ${prefix}`,
                count: importedIcons.length,
                styleManifest: manifest,
            };

            const updatedSources = [...sources, newSource];
            setSources(updatedSources);
            await saveIconSources(updatedSources);

            // Clear from results to indicate it's imported
            setIconifyResults(prev => prev.filter(c => c.prefix !== prefix));

            alert(`Successfully imported ${importedIcons.length} icons from ${collectionName}!`);
        } catch (error) {
            console.error("[Iconify Import] Error:", error);
            alert(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            console.log("[Iconify Import] Finished");
            setImportingIconify(null);
            setIconifyImportProgress("");
        }
    };

    const handleEnrichLibrary = async () => {
        if (!apiKey) {
            alert("Please enter your Gemini API Key first");
            return;
        }

        setEnriching(true);
        setEnrichProgress(0);

        try {
            // Determine which icons to enrich
            let iconsToEnrich = icons;

            if (enrichTarget === "missing") {
                iconsToEnrich = icons.filter(icon => !icon.aiDescription);
            } else if (enrichTarget === "favorites") {
                if (!currentProject) {
                    alert("No project selected");
                    setEnriching(false);
                    return;
                }
                iconsToEnrich = icons.filter(icon =>
                    currentProject.favorites.includes(icon.id)
                );
            }

            if (iconsToEnrich.length === 0) {
                alert("No icons to enrich");
                setEnriching(false);
                return;
            }

            const batchSize = 10;
            const batches = [];
            for (let i = 0; i < iconsToEnrich.length; i += batchSize) {
                batches.push(iconsToEnrich.slice(i, i + batchSize));
            }

            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                const res = await fetch("/api/enrich", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ icons: batch, apiKey })
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || "API Failed");
                }

                const { data } = await res.json();

                // Update icons with enriched data
                const updatedIcons = icons.map(icon => {
                    const enriched = data.find((d: any) => d.id === icon.id);
                    if (enriched) {
                        return {
                            ...icon,
                            tags: [...new Set([...icon.tags, ...(enriched.tags || [])])],
                            aiDescription: enriched.description,
                            // NEW: AI metadata for smart sample selection
                            aiMetadata: enriched.semanticCategory ? {
                                semanticCategory: enriched.semanticCategory,
                                complexity: enriched.complexity || 3,
                                geometricTraits: enriched.geometricTraits || [],
                                confidence: 0.8,
                            } : undefined,
                            // F3: Component data for Kitbash
                            components: enriched.components || undefined,
                            componentSignature: enriched.componentSignature || undefined,
                        };
                    }
                    return icon;
                });

                setIcons(updatedIcons);

                // Update IndexedDB
                const storedIcons = await getIngestedIcons();
                const updatedStored = storedIcons.map((icon: any) => {
                    const enriched = data.find((d: any) => d.id === icon.id);
                    if (enriched) {
                        return {
                            ...icon,
                            tags: [...new Set([...icon.tags, ...(enriched.tags || [])])],
                            aiDescription: enriched.description,
                            // NEW: AI metadata for smart sample selection
                            aiMetadata: enriched.semanticCategory ? {
                                semanticCategory: enriched.semanticCategory,
                                complexity: enriched.complexity || 3,
                                geometricTraits: enriched.geometricTraits || [],
                                confidence: 0.8,
                            } : undefined,
                            // F3: Component data for Kitbash
                            components: enriched.components || undefined,
                            componentSignature: enriched.componentSignature || undefined,
                        };
                    }
                    return icon;
                });
                await saveIngestedIcons(updatedStored);

                setEnrichProgress(((i + 1) / batches.length) * 100);
            }

            alert("Enrichment complete!");
        } catch (error) {
            alert(`Enrichment failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setEnriching(false);
            setEnrichProgress(0);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[1200px] w-[90vw] h-[80vh] p-0 overflow-hidden flex flex-col md:flex-row gap-0">
                <DialogHeader className="sr-only">
                    <DialogTitle>Settings</DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="library" orientation="vertical" className="flex-1 flex flex-col md:flex-row h-full">
                    {/* Sidebar Navigation */}
                    <div className="w-full md:w-64 border-r bg-muted/30 flex flex-col h-full">
                        <div className="p-6 border-b">
                            <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
                            <p className="text-sm text-muted-foreground">Manage your workspace</p>
                        </div>
                        <TabsList className="flex flex-col h-auto bg-transparent p-2 gap-1 justify-start">
                            <TabsTrigger
                                value="library"
                                className="w-full justify-start px-4 py-2 h-auto data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                <Github className="mr-2 h-4 w-4" />
                                Library
                            </TabsTrigger>
                            <TabsTrigger
                                value="ai"
                                className="w-full justify-start px-4 py-2 h-auto data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                <Sparkles className="mr-2 h-4 w-4" />
                                AI Enrichment
                            </TabsTrigger>
                            <TabsTrigger
                                value="generation"
                                className="w-full justify-start px-4 py-2 h-auto data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                <Wand2 className="mr-2 h-4 w-4" />
                                Generation
                            </TabsTrigger>
                            <TabsTrigger
                                value="api"
                                className="w-full justify-start px-4 py-2 h-auto data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                <Key className="mr-2 h-4 w-4" />
                                API Key
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 h-full overflow-y-auto bg-background">
                        <div className="p-6 max-w-3xl mx-auto space-y-6">

                            {/* Library Management */}
                            <TabsContent value="library" className="space-y-6 m-0">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-semibold tracking-tight">Icon Library</h3>
                                    <p className="text-sm text-muted-foreground">Manage your ingested icon sets and their style DNA.</p>
                                </div>
                                <Separator />

                                {/* Import Section */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Import from GitHub</CardTitle>
                                        <CardDescription>
                                            Ingest SVG icons directly from a public repository.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="repo-url">Repository URL</Label>
                                                    <Input
                                                        id="repo-url"
                                                        placeholder="https://github.com/owner/repo"
                                                        value={repoUrl}
                                                        onChange={(e) => setRepoUrl(e.target.value)}
                                                        disabled={ingesting}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="path">Path to Icons</Label>
                                                    <Input
                                                        id="path"
                                                        placeholder="icons/svg"
                                                        value={pathInRepo}
                                                        onChange={(e) => setPathInRepo(e.target.value)}
                                                        disabled={ingesting}
                                                    />
                                                </div>
                                            </div>

                                            {ingesting && (
                                                <div className="text-sm text-muted-foreground">
                                                    {ingestProgress}
                                                </div>
                                            )}

                                            <Button
                                                onClick={handleIngestLibrary}
                                                disabled={ingesting}
                                                className="w-full"
                                            >
                                                {ingesting ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Ingesting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Github className="mr-2 h-4 w-4" />
                                                        Ingest Library
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Iconify Import Section */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Globe className="h-5 w-5" />
                                            Import from Iconify
                                        </CardTitle>
                                        <CardDescription>
                                            Browse and import from 275,000+ open-source icons across 200+ libraries.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="Search collections (e.g., lucide, tabler, feather...)"
                                                    value={iconifySearch}
                                                    onChange={(e) => setIconifySearch(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && handleSearchIconify()}
                                                    disabled={searchingIconify || !!importingIconify}
                                                />
                                                <Button
                                                    onClick={handleSearchIconify}
                                                    disabled={searchingIconify || !!importingIconify}
                                                    variant="secondary"
                                                >
                                                    {searchingIconify ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Search className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </div>

                                            {iconifyResults.length === 0 && !searchingIconify && (
                                                <Button
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={handleLoadPopularCollections}
                                                >
                                                    <Globe className="mr-2 h-4 w-4" />
                                                    Browse Popular Stroke-Based Libraries
                                                </Button>
                                            )}

                                            {importingIconify && (
                                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    {iconifyImportProgress}
                                                </div>
                                            )}

                                            {iconifyResults.length > 0 && (
                                                <div className="grid gap-2 max-h-64 overflow-y-auto">
                                                    {iconifyResults.map((collection) => (
                                                        <div
                                                            key={collection.prefix}
                                                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                                                        >
                                                            <div>
                                                                <div className="font-medium">{collection.name}</div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {collection.total.toLocaleString()} icons
                                                                    {collection.license && ` • ${collection.license}`}
                                                                </div>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleImportIconifyCollection(collection.prefix)}
                                                                disabled={!!importingIconify}
                                                            >
                                                                {importingIconify === collection.prefix ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    "Import"
                                                                )}
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Installed Libraries Section */}
                                {sources.length > 0 && (
                                    <div className="space-y-4 pt-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-semibold">Installed Libraries</h3>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={handleClearAllData}
                                            >
                                                <AlertTriangle className="mr-2 h-4 w-4" />
                                                Clear All Data
                                            </Button>
                                        </div>

                                        <div className="grid gap-4">
                                            {sources.map((source) => (
                                                <Card key={source.id}>
                                                    <CardContent className="flex flex-col gap-4 p-6">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-4">
                                                                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                                                    {source.path.startsWith("Iconify:") ? (
                                                                        <Globe className="h-5 w-5" />
                                                                    ) : (
                                                                        <Github className="h-5 w-5" />
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <h3 className="font-medium">{source.name}</h3>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        {source.url}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-secondary-foreground">
                                                                            {source.count} icons
                                                                        </span>
                                                                        {source.styleManifest && (
                                                                            <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                                                <Sparkles className="h-3 w-3" />
                                                                                DNA Extracted
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleEditDNA(source)}
                                                                >
                                                                    Edit DNA
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    title="Regenerate DNA"
                                                                    onClick={() => handleRegenerateDNA(source)}
                                                                    disabled={!!regeneratingId}
                                                                >
                                                                    {regeneratingId === source.id ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <RefreshCw className="h-4 w-4" />
                                                                    )}
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                    onClick={() => handleDeleteSource(source.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {/* DNA Editor */}
                                                        {editingSourceId === source.id && (
                                                            <div className="mt-4 space-y-4 border-t pt-4">
                                                                <div className="space-y-2">
                                                                    <Label>Style DNA (Manifest)</Label>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        This is the "Genetic Code" the AI uses to replicate this library's style.
                                                                        Edit with caution.
                                                                    </p>
                                                                    <textarea
                                                                        className="w-full h-64 p-4 font-mono text-sm bg-muted/50 rounded-md border resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                                                                        value={editingManifest}
                                                                        onChange={(e) => setEditingManifest(e.target.value)}
                                                                    />
                                                                </div>
                                                                <div className="flex justify-end gap-2">
                                                                    <Button variant="ghost" size="sm" onClick={handleCancelEditDNA}>
                                                                        Cancel
                                                                    </Button>
                                                                    <Button size="sm" onClick={handleSaveDNA}>
                                                                        Save DNA Changes
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            {/* AI Enrichment */}
                            <TabsContent value="ai" className="space-y-6 m-0">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-semibold tracking-tight">AI Enrichment</h3>
                                    <p className="text-sm text-muted-foreground">Generate smart tags and descriptions for your icons.</p>
                                </div>
                                <Separator />
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Batch Processing</CardTitle>
                                        <CardDescription>
                                            Select which icons to process. This requires a Gemini API key.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="space-y-4">
                                            <RadioGroup value={enrichTarget} onValueChange={(v: string) => setEnrichTarget(v as "all" | "missing" | "favorites")}>
                                                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                                                    <RadioGroupItem value="all" id="all" />
                                                    <Label htmlFor="all" className="flex-1 cursor-pointer">
                                                        <div className="font-medium">All Icons</div>
                                                        <div className="text-xs text-muted-foreground">{allCount} icons total</div>
                                                    </Label>
                                                </div>
                                                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                                                    <RadioGroupItem value="missing" id="missing" />
                                                    <Label htmlFor="missing" className="flex-1 cursor-pointer">
                                                        <div className="font-medium">Missing Descriptions</div>
                                                        <div className="text-xs text-muted-foreground">{missingCount} icons without AI descriptions</div>
                                                    </Label>
                                                </div>
                                                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                                                    <RadioGroupItem value="favorites" id="favorites" />
                                                    <Label htmlFor="favorites" className="flex-1 cursor-pointer">
                                                        <div className="font-medium">Favorites</div>
                                                        <div className="text-xs text-muted-foreground">{favoritesCount} favorited icons</div>
                                                    </Label>
                                                </div>
                                            </RadioGroup>
                                        </div>

                                        {enriching && (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-muted-foreground italic transition-opacity">
                                                        {ENRICHMENT_MESSAGES[enrichStatusIndex]}
                                                    </span>
                                                    <span className="font-medium">{Math.round(enrichProgress)}%</span>
                                                </div>
                                                <Progress value={enrichProgress} />
                                            </div>
                                        )}

                                        <Button
                                            onClick={handleEnrichLibrary}
                                            disabled={enriching || !apiKey}
                                            className="w-full"
                                        >
                                            {enriching ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Working...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="mr-2 h-4 w-4" />
                                                    Start Enrichment
                                                </>
                                            )}
                                        </Button>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* Generation Settings */}
                            <TabsContent value="generation" className="space-y-6 m-0">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-semibold tracking-tight">Generation Pipeline</h3>
                                    <p className="text-sm text-muted-foreground">Configure the AI generation engine.</p>
                                </div>
                                <Separator />
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Pipeline Configuration</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="flex items-center justify-between space-x-2">
                                            <div className="space-y-0.5">
                                                <Label htmlFor="legacy-mode">Legacy Prompt Pipeline</Label>
                                                <p className="text-sm text-muted-foreground">
                                                    Disable the experimental "Meta-Prompting" engine and use the original template-based prompts.
                                                </p>
                                            </div>
                                            <Switch
                                                id="legacy-mode"
                                                checked={useLegacyPrompt}
                                                onCheckedChange={handleToggleLegacyPrompt}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* API Key */}
                            <TabsContent value="api" className="space-y-6 m-0">
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-semibold tracking-tight">API Configuration</h3>
                                    <p className="text-sm text-muted-foreground">Manage your external service keys.</p>
                                </div>
                                <Separator />
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Gemini API Key</CardTitle>
                                        <CardDescription>
                                            Required for AI-powered icon enrichment and generation.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="api-key">API Key</Label>
                                            <Input
                                                id="api-key"
                                                type="password"
                                                placeholder="Enter your Gemini API key"
                                                value={apiKey}
                                                onChange={(e) => setApiKey(e.target.value)}
                                            />
                                        </div>
                                        <Button onClick={handleSaveApiKey} className="w-full">
                                            <Key className="mr-2 h-4 w-4" />
                                            Save API Key
                                        </Button>
                                        <p className="text-xs text-muted-foreground">
                                            Get your API key from{" "}
                                            <a
                                                href="https://aistudio.google.com/app/apikey"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary hover:underline"
                                            >
                                                Google AI Studio
                                            </a>
                                        </p>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </div>
                    </div>
                </Tabs>
            </DialogContent >
        </Dialog >
    );
}
