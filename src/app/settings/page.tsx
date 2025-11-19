"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Github, Loader2, Plus, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ingestGitHubRepo } from "@/lib/ingestion-service";

export default function SettingsPage() {
    const [repoUrl, setRepoUrl] = useState("");
    const [repoPath, setRepoPath] = useState("");
    const [loading, setLoading] = useState(false);
    const [sources, setSources] = useState<any[]>([]);

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
            const newSource = {
                id: Date.now().toString(),
                name: repoUrl.split("/").pop() || "Unknown Repo",
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
            </div>
        </div>
    );
}
