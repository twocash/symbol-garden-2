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
import { Icon } from "@/types/schema";
import { Sparkles, Key, Loader2, Github, Trash2, AlertTriangle, Wand2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

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
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
    const { icons, setIcons } = useSearch();
    const { currentProject } = useProject();
    const [apiKey, setApiKey] = useState("");
    const [enriching, setEnriching] = useState(false);
    const [enrichProgress, setEnrichProgress] = useState(0);
    const [enrichTarget, setEnrichTarget] = useState<"all" | "missing" | "favorites">("missing");

    // Library ingestion state
    const [ingesting, setIngesting] = useState(false);
    const [ingestProgress, setIngestProgress] = useState("");
    const [repoUrl, setRepoUrl] = useState("");
    const [pathInRepo, setPathInRepo] = useState("");
    const [sources, setSources] = useState<Source[]>([]);
    const [useLegacyPrompt, setUseLegacyPrompt] = useState(false);

    // Calculate icon counts for enrichment options
    const allCount = icons.length;
    const missingCount = icons.filter(i => !i.aiDescription).length;
    const favoritesCount = currentProject?.favorites.length || 0;

    // Load API key and sources from localStorage
    useEffect(() => {
        const storedKey = localStorage.getItem("gemini_api_key");
        if (storedKey) setApiKey(storedKey);

        const storedSources = localStorage.getItem("icon_sources");
        if (storedSources) setSources(JSON.parse(storedSources));

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
            const newIcons = await ingestGitHubRepo(
                repoUrl,
                pathInRepo,
                (current, total, status) => {
                    setIngestProgress(`${status} (${current}/${total})`);
                }
            );

            // Save icons
            const existingIcons = JSON.parse(localStorage.getItem("ingested_icons") || "[]");
            const merged = [...existingIcons, ...newIcons];
            localStorage.setItem("ingested_icons", JSON.stringify(merged));
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
                count: newIcons.length
            };

            const updatedSources = [...sources, newSource];
            setSources(updatedSources);
            localStorage.setItem("icon_sources", JSON.stringify(updatedSources));

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

    const handleDeleteSource = (sourceId: string) => {
        const source = sources.find(s => s.id === sourceId);
        if (!source) return;

        if (!confirm(`Delete library "${source.name}"? This will remove all ${source.count} icons from this library.`)) {
            return;
        }

        // Remove icons from this library
        const allIcons = JSON.parse(localStorage.getItem("ingested_icons") || "[]");
        const filtered = allIcons.filter((icon: Icon) => icon.library !== source.name);
        localStorage.setItem("ingested_icons", JSON.stringify(filtered));
        setIcons(filtered);

        // Remove source
        const updatedSources = sources.filter(s => s.id !== sourceId);
        setSources(updatedSources);
        localStorage.setItem("icon_sources", JSON.stringify(updatedSources));

        alert(`Deleted ${source.name} and removed ${source.count} icons`);
    };

    const handleClearAllData = () => {
        if (!confirm("⚠️ Clear ALL ingested libraries and icons? This cannot be undone!")) {
            return;
        }

        localStorage.removeItem("ingested_icons");
        localStorage.removeItem("icon_sources");
        setSources([]);
        setIcons([]);

        alert("All data cleared successfully");
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
                    const enriched = data.find((d: any) => d.name === icon.name && d.library === icon.library);
                    if (enriched) {
                        return {
                            ...icon,
                            tags: [...new Set([...icon.tags, ...enriched.tags])],
                            aiDescription: enriched.description
                        };
                    }
                    return icon;
                });

                setIcons(updatedIcons);

                // Update localStorage
                const storedIcons = JSON.parse(localStorage.getItem("ingested_icons") || "[]");
                const updatedStored = storedIcons.map((icon: any) => {
                    const enriched = data.find((d: any) => d.name === icon.name && d.library === icon.library);
                    if (enriched) {
                        return {
                            ...icon,
                            tags: [...new Set([...icon.tags, ...enriched.tags])],
                            aiDescription: enriched.description
                        };
                    }
                    return icon;
                });
                localStorage.setItem("ingested_icons", JSON.stringify(updatedStored));

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
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="library" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="library">Library</TabsTrigger>
                        <TabsTrigger value="ai">AI Enrichment</TabsTrigger>
                        <TabsTrigger value="generation">Generation</TabsTrigger>
                        <TabsTrigger value="api">API Key</TabsTrigger>
                    </TabsList>

                    {/* Library Management */}
                    <TabsContent value="library" className="space-y-6 mt-4">
                        {/* Import Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Import Icon Library</CardTitle>
                                <CardDescription>
                                    Enter a GitHub repository URL and path to ingest SVG icons
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="repo-url">GitHub Repository URL</Label>
                                            <Input
                                                id="repo-url"
                                                placeholder="https://github.com/owner/repo"
                                                value={repoUrl}
                                                onChange={(e) => setRepoUrl(e.target.value)}
                                                disabled={ingesting}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="path">Path in Repository</Label>
                                            <Input
                                                id="path"
                                                placeholder="icons"
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
                                    <p className="text-xs text-muted-foreground">
                                        Example: <code className="bg-muted px-1 rounded">https://github.com/lucide-icons/lucide</code> with path <code className="bg-muted px-1 rounded">icons</code>
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Installed Libraries Section */}
                        {sources.length > 0 && (
                            <>
                                <Separator />
                                <div className="space-y-4">
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
                                                <CardContent className="flex items-center justify-between p-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                                            <Github className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-medium">{source.name}</h3>
                                                            <p className="text-sm text-muted-foreground">
                                                                {source.url} / {source.path}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                {source.count} icons
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDeleteSource(source.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </TabsContent>

                    {/* AI Enrichment */}
                    <TabsContent value="ai" className="space-y-4 mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Batch AI Enrichment</CardTitle>
                                <CardDescription>
                                    Generate descriptions and tags for your icons
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <Label>Which icons to enrich?</Label>
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
                                            <span>Enriching...</span>
                                            <span>{Math.round(enrichProgress)}%</span>
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
                                            Enriching...
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

                    {/* API Key */}
                    <TabsContent value="api" className="space-y-4 mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Gemini API Key</CardTitle>
                                <CardDescription>
                                    Required for AI-powered icon enrichment
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

                    {/* Generation Settings */}
                    <TabsContent value="generation" className="space-y-4 mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Generation Pipeline</CardTitle>
                                <CardDescription>
                                    Configure how the AI generates icons
                                </CardDescription>
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
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
