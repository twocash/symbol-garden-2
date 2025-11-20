"use client";

import { useProject } from "@/lib/project-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FolderOpen, Plus, Trash2, Check } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

export default function ProjectsPage() {
    const { projects, currentProject, createProject, switchProject, deleteProject } = useProject();
    const [newProjectName, setNewProjectName] = useState("");

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (newProjectName.trim()) {
            createProject(newProjectName.trim());
            setNewProjectName("");
        }
    };

    return (
        <div className="container max-w-4xl py-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
                <p className="text-muted-foreground">Manage your icon collections and workspaces.</p>
            </div>

            <Separator />

            <div className="grid gap-8">
                <section className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Create New Project</CardTitle>
                            <CardDescription>
                                Start a new collection of icons for a specific project or client.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreate} className="flex gap-4 items-end">
                                <div className="grid gap-2 flex-1">
                                    <Label htmlFor="project-name">Project Name</Label>
                                    <Input
                                        id="project-name"
                                        placeholder="e.g., Marketing Website, Q4 Pitch Deck"
                                        value={newProjectName}
                                        onChange={(e) => setNewProjectName(e.target.value)}
                                        required
                                    />
                                </div>
                                <Button type="submit">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Project
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <div className="grid gap-4">
                        {projects.map((project) => (
                            <Card key={project.id} className={currentProject?.id === project.id ? "border-primary" : ""}>
                                <CardContent className="flex items-center justify-between p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                            <FolderOpen className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-medium">{project.name}</h3>
                                                {currentProject?.id === project.id && (
                                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {project.favorites.length} favorites • Updated {formatDistanceToNow(new Date(project.updatedAt))} ago
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {currentProject?.id !== project.id && (
                                            <Button variant="secondary" size="sm" onClick={() => switchProject(project.id)}>
                                                Switch to Project
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => {
                                                if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
                                                    deleteProject(project.id);
                                                }
                                            }}
                                            disabled={projects.length === 1}
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
