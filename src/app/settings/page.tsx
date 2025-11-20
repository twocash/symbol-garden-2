"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Github, Loader2, Plus, Trash2, Sparkles } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ingestGitHubRepo } from "@/lib/ingestion-service";

export default function SettingsPage() {
    const [repoUrl, setRepoUrl] = useState("");
    const [repoPath, setRepoPath] = useState("");
    const [loading, setLoading] = useState(false);
    const [sources, setSources] = useState<any[]>([]);
    const [apiKey, setApiKey] = useState("");
    const [enriching, setEnriching] = useState(false);
    const [enrichmentProgress, setEnrichmentProgress] = useState(0);
    const [testingApi, setTestingApi] = useState(false);

    // Load sources from localStorage on mount
    useEffect(() => {
        const storedSources = localStorage.getItem("icon_sources");
        if (storedSources) {
            setSources(JSON.parse(storedSources));
        } else {
            // Default sources for demo
            setSources([
                { id: "1", name: "Phosphor Icons", url: "https://github.com/phosphor-icons/core", path: "assets/regular", count: 1240 },
                { id: "2", name: "Lucide", url: "https://github.com/lucide-icons/lucide", path: "icons", count: 850 },
            ]);
        }

        // Load API key
        const storedApiKey = localStorage.getItem("gemini_api_key");
        if (storedApiKey) {
            setApiKey(storedApiKey);
        }
    }, []);

    const handleAddSource = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const newIcons = await ingestGitHubRepo(repoUrl, repoPath, (current, total, status) => {
                console.log(`Progress: ${current}/${total} - ${status}`);
            });

            // Save icons to localStorage
            const existingIcons = JSON.parse(localStorage.getItem("ingested_icons") || "[]");
            const updatedIcons = [...existingIcons, ...newIcons];
            localStorage.setItem("ingested_icons", JSON.stringify(updatedIcons));

            // Update sources list
            // Extract repo name from URL (e.g., "lucide" from "https://github.com/lucide-icons/lucide")
            const urlParts = repoUrl.replace("https://github.com/", "").split("/");
            const repoName = urlParts[1] || urlParts[0] || "Unknown Repo";

            const newSource = {
                id: Date.now().toString(),
                name: repoName, // Use repo name to match icon.library field
                url: repoUrl,
                path: repoPath,
                count: newIcons.length
            };

            const updatedSources = [...sources, newSource];
            setSources(updatedSources);
            localStorage.setItem("icon_sources", JSON.stringify(updatedSources));

            alert(`Successfully ingested ${newIcons.length} icons!`);
            setRepoUrl("");
            setRepoPath("");

            // Force reload to update search context (simple way for MVP)
            window.location.reload();
        } catch (error) {
            console.error(error);
            alert(`Failed to ingest icons: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setLoading(false);
        }
    };

    const handleClearStorage = () => {
        if (confirm("Are you sure you want to clear all ingested icons?")) {
            localStorage.removeItem("ingested_icons");
            localStorage.removeItem("icon_sources");
            setSources([]);
            window.location.reload();
        }
    };

    const handleDeleteSource = (sourceToDelete: any) => {
        if (confirm(`Are you sure you want to delete "${sourceToDelete.name}"? This will remove all ${sourceToDelete.count} icons from this library.`)) {
            // Remove icons from this library
            const existingIcons = JSON.parse(localStorage.getItem("ingested_icons") || "[]");
            const filteredIcons = existingIcons.filter((icon: any) => icon.library !== sourceToDelete.name);
            localStorage.setItem("ingested_icons", JSON.stringify(filteredIcons));

            // Remove source from list
            const updatedSources = sources.filter(s => s.id !== sourceToDelete.id);
            setSources(updatedSources);
            localStorage.setItem("icon_sources", JSON.stringify(updatedSources));

            // Reload to update search context
            window.location.reload();
        }
    };

    const handleSaveApiKey = () => {
        localStorage.setItem("gemini_api_key", apiKey);
        alert("API Key saved successfully!");
    };

    const handleTestApiKey = async () => {
        if (!apiKey) {
            alert("Please enter an API key first.");
            return;
        }

        setTestingApi(true);
        try {
            const res = await fetch("/api/list-models", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ apiKey })
            });

            if (!res.ok) {
                throw new Error("Failed to fetch models");
            }

            const { models } = await res.json();
            alert(`API Key is valid!\n\nAvailable models:\n${models.map((m: any) => `- ${m.name}`).join("\n")}`);
        } catch (error) {
            alert(`API Test failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setTestingApi(false);
        }
    };

    const handleEnrichLibrary = async () => {
        if (!apiKey) {
            alert("Please enter and save your Gemini API Key first.");
            return;
        }

        const allIcons = JSON.parse(localStorage.getItem("ingested_icons") || "[]");
        const unenrichedIcons = allIcons.filter((icon: any) => !icon.aiDescription);

        if (unenrichedIcons.length === 0) {
            alert("All icons are already enriched!");
            return;
        }

        if (!confirm(`This will enrich ${unenrichedIcons.length} icons. Continue?`)) {
            return;
        }

        setEnriching(true);
        setEnrichmentProgress(0);

        const BATCH_SIZE = 10;
        let enriched = 0;

        try {
            for (let i = 0; i < unenrichedIcons.length; i += BATCH_SIZE) {
                const batch = unenrichedIcons.slice(i, i + BATCH_SIZE);

                let res;
                try {
                    res = await fetch("/api/enrich", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ icons: batch, apiKey })
                    });

                    if (!res.ok) {
                        throw new Error(`Batch ${i / BATCH_SIZE + 1} failed`);
                    }

                    const { data } = await res.json();

                    // Merge enriched data back
                    data.forEach((enrichedIcon: any) => {
                        const iconIndex = allIcons.findIndex((icon: any) => icon.id === enrichedIcon.id);
                        if (iconIndex !== -1) {
                            allIcons[iconIndex].tags = [...new Set([...allIcons[iconIndex].tags, ...enrichedIcon.tags])];
                            allIcons[iconIndex].aiDescription = enrichedIcon.description;
                        }
                    });

                    enriched += batch.length;
                } catch (batchError) {
                    console.error(`Error processing batch ${i / BATCH_SIZE + 1}:`, batchError);
                    // Continue to next batch
                }

                setEnrichmentProgress(((i + BATCH_SIZE) / unenrichedIcons.length) * 100);
            }

            // Save updated icons
            localStorage.setItem("ingested_icons", JSON.stringify(allIcons));
            alert(`Enrichment complete! Successfully enriched ${enriched} icons.`);
            window.location.reload();
        } catch (error) {
            alert(`Enrichment failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setEnriching(false);
            setEnrichmentProgress(0);
        }
    };

    return (
        <div className="container max-w-4xl py-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage your icon sources and application preferences.</p>
            </div>

            <Separator />

            <div className="grid gap-8">
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold tracking-tight">Icon Sources</h2>
                        <Button variant="destructive" size="sm" onClick={handleClearStorage}>
                            Clear All Data
                        </Button>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Add GitHub Repository</CardTitle>
                            <CardDescription>
                                Connect a public GitHub repository to ingest icons directly.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleAddSource} className="flex gap-4 items-end">
                                <div className="grid gap-2 flex-1">
                                    <Label htmlFor="repo-url">Repository URL</Label>
                                    <Input
                                        id="repo-url"
                                        placeholder="https://github.com/owner/repo"
                                        value={repoUrl}
                                        onChange={(e) => setRepoUrl(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2 w-1/3">
                                    <Label htmlFor="repo-path">Path to Icons</Label>
                                    <Input
                                        id="repo-path"
                                        placeholder="assets/icons"
                                        value={repoPath}
                                        onChange={(e) => setRepoPath(e.target.value)}
                                    />
                                </div>
                                <Button type="submit" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                    Add Source
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

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
                                            <p className="text-sm text-muted-foreground">{source.url} / {source.path}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-sm font-medium">{source.count} icons</p>
                                            <p className="text-xs text-muted-foreground">Ingested</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDeleteSource(source)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold tracking-tight">AI Enrichment</h2>

                    <Card>
                        <CardHeader>
                            <CardTitle>Gemini API Key</CardTitle>
                            <CardDescription>
                                Enter your Google Gemini API key to enable AI-powered icon descriptions and tag generation.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Input
                                        type="password"
                                        placeholder="Enter your Gemini API key"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                    />
                                </div>
                                <Button onClick={handleSaveApiKey} variant="outline">
                                    Save
                                </Button>
                                <Button onClick={handleTestApiKey} variant="secondary" disabled={testingApi}>
                                    {testingApi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Test
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Button
                                    onClick={handleEnrichLibrary}
                                    disabled={enriching || !apiKey}
                                    className="w-full"
                                >
                                    {enriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                    {enriching ? "Enriching..." : "Start Enrichment"}
                                </Button>
                                {enriching && (
                                    <div className="space-y-1">
                                        <Progress value={enrichmentProgress} />
                                        <p className="text-sm text-muted-foreground text-center">
                                            {Math.round(enrichmentProgress)}% complete
                                        </p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </div>
        </div>
    );
}
