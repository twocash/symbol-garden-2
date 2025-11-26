"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";
import { Project, Icon } from "@/types/schema";
import { nanoid } from "nanoid";
import { getProjects, saveProjectsToIDB } from "@/lib/storage";

interface ProjectContextType {
    projects: Project[];
    currentProject: Project | null;
    createProject: (name: string) => void;
    renameProject: (projectId: string, newName: string) => void;
    duplicateProject: (projectId: string, newName: string, copyFavorites: boolean) => void;
    switchProject: (projectId: string) => void;
    deleteProject: (projectId: string) => void;
    updateProject: (project: Project) => void;
    toggleFavorite: (iconId: string) => void;
    addSecondaryColor: (projectId: string, color: string) => void;
    updateSecondaryColor: (projectId: string, index: number, color: string) => void;
    removeSecondaryColor: (projectId: string, index: number) => void;
    addIconToProject: (icon: Icon, shouldFavorite?: boolean) => void;
    deleteIconFromProject: (iconId: string) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

    // Load projects from localStorage on mount
    // Load projects from IndexedDB on mount (with migration from localStorage)
    useEffect(() => {
        async function load() {
            // 1. Try loading from IndexedDB
            let loadedProjects = await getProjects();

            // 2. If empty, check localStorage (Migration)
            if (loadedProjects.length === 0) {
                const storedProjects = localStorage.getItem("projects");
                if (storedProjects) {
                    try {
                        loadedProjects = JSON.parse(storedProjects);
                        // Save to IDB immediately
                        await saveProjectsToIDB(loadedProjects);
                        // Clear localStorage to free up space
                        localStorage.removeItem("projects");
                        console.log("Migrated projects from localStorage to IndexedDB");
                    } catch (e) {
                        console.error("Failed to parse localStorage projects", e);
                    }
                }
            }

            // 3. If still empty, create default
            if (loadedProjects.length === 0) {
                const defaultProject: Project = {
                    id: "default",
                    name: "Default Project",
                    slug: "default-project",
                    primaryLibrary: "all",
                    fallbackLibraries: [],
                    icons: {},
                    customIcons: [],
                    favorites: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                loadedProjects = [defaultProject];
                await saveProjectsToIDB(loadedProjects);
            }

            // 4. Set State
            const activeProjects = loadedProjects.filter((p: Project) => !p.deletedAt);
            setProjects(activeProjects);

            // 5. Restore current project ID
            const storedCurrentId = localStorage.getItem("currentProjectId");
            if (storedCurrentId && activeProjects.find((p: Project) => p.id === storedCurrentId)) {
                setCurrentProjectId(storedCurrentId);
            } else if (activeProjects.length > 0) {
                setCurrentProjectId(activeProjects[0].id);
            }
        }
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const currentProject = projects.find(p => p.id === currentProjectId) || null;

    const saveProjects = async (newProjects: Project[]) => {
        setProjects(newProjects);
        try {
            await saveProjectsToIDB(newProjects);
        } catch (error) {
            console.error("Failed to save projects to IndexedDB:", error);
            toast.error("Failed to save project changes.");
        }
    };

    const createProject = (name: string) => {
        const newProject: Project = {
            id: nanoid(),
            name,
            slug: name.toLowerCase().replace(/\s+/g, "-"),
            primaryLibrary: "all",
            fallbackLibraries: [],
            icons: {},
            customIcons: [],
            favorites: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setProjects(prev => {
            const updated = [...prev, newProject];
            saveProjectsToIDB(updated); // Fire and forget
            return updated;
        });

        // Delay context switch to ensure state is updated
        setTimeout(() => switchProject(newProject.id), 0);
    };

    const renameProject = (projectId: string, newName: string) => {
        // Validation
        if (newName.length < 2 || newName.length > 40) {
            throw new Error("Please enter 2–40 characters.");
        }

        if (projects.some(p => p.id !== projectId && p.name === newName)) {
            throw new Error("That name is already in use.");
        }

        const updatedProjects = projects.map(p =>
            p.id === projectId ? {
                ...p,
                name: newName,
                slug: newName.toLowerCase().replace(/\s+/g, "-"),
                updatedAt: new Date().toISOString()
            } : p
        );

        saveProjects(updatedProjects);
    };

    const duplicateProject = (projectId: string, newName: string, copyFavorites: boolean) => {
        const source = projects.find(p => p.id === projectId);
        if (!source) return;

        const newProject: Project = {
            ...source,
            id: nanoid(),
            name: newName,
            slug: newName.toLowerCase().replace(/\s+/g, "-"),
            customIcons: copyFavorites ? [...(source.customIcons || [])] : [], // Copy custom icons if copying favorites? Or always? Let's assume copy favorites implies copying content.
            favorites: copyFavorites ? [...source.favorites] : [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setProjects(prev => {
            const updated = [...prev, newProject];
            saveProjectsToIDB(updated); // Fire and forget
            return updated;
        });

        setTimeout(() => switchProject(newProject.id), 0);
    };

    const switchProject = (projectId: string) => {
        setCurrentProjectId(projectId);
        localStorage.setItem("currentProjectId", projectId);
    };

    const deleteProject = (projectId: string) => {
        // Prevent deleting the last non-default workspace
        const activeProjects = projects.filter(p => !p.deletedAt);
        if (activeProjects.filter(p => p.id !== "default").length === 1 && projectId !== "default") {
            throw new Error("You must have at least one workspace.");
        }

        // Soft-delete by adding deletedAt timestamp
        const updatedProjects = projects.map(p =>
            p.id === projectId ? { ...p, deletedAt: new Date().toISOString() } : p
        );
        saveProjects(updatedProjects);

        if (currentProjectId === projectId) {
            const nextProject = updatedProjects.filter(p => !p.deletedAt)[0] || null;
            const nextId = nextProject ? nextProject.id : null;
            setCurrentProjectId(nextId);
            if (nextId) {
                localStorage.setItem("currentProjectId", nextId);
            } else {
                localStorage.removeItem("currentProjectId");
            }
        }
    };

    const updateProject = (updatedProject: Project) => {
        const updatedProjects = projects.map(p =>
            p.id === updatedProject.id ? updatedProject : p
        );
        saveProjects(updatedProjects);
    };

    const toggleFavorite = (iconId: string) => {
        if (!currentProject) return;

        const isFavorite = currentProject.favorites.includes(iconId);
        let newFavorites;

        if (isFavorite) {
            newFavorites = currentProject.favorites.filter(id => id !== iconId);
        } else {
            newFavorites = [...currentProject.favorites, iconId];
        }

        const updatedProject = {
            ...currentProject,
            favorites: newFavorites,
            updatedAt: new Date().toISOString()
        };

        updateProject(updatedProject);
    };

    const addSecondaryColor = (projectId: string, color: string) => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        const MAX_SECONDARY_COLORS = 8;
        const currentColors = project.secondaryColors || [];

        if (currentColors.length >= MAX_SECONDARY_COLORS) {
            throw new Error(`Maximum of ${MAX_SECONDARY_COLORS} secondary colors allowed`);
        }

        // Validate hex color format
        if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
            throw new Error("Invalid hex color format");
        }

        const updatedProject = {
            ...project,
            secondaryColors: [...currentColors, color],
            updatedAt: new Date().toISOString()
        };

        updateProject(updatedProject);
    };

    const updateSecondaryColor = (projectId: string, index: number, color: string) => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        const currentColors = project.secondaryColors || [];
        if (index < 0 || index >= currentColors.length) return;

        // Validate hex color format
        if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
            throw new Error("Invalid hex color format");
        }

        const updatedColors = [...currentColors];
        updatedColors[index] = color;

        const updatedProject = {
            ...project,
            secondaryColors: updatedColors,
            updatedAt: new Date().toISOString()
        };

        updateProject(updatedProject);
    };

    const removeSecondaryColor = (projectId: string, index: number) => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return;

        const currentColors = project.secondaryColors || [];
        if (index < 0 || index >= currentColors.length) return;

        const updatedColors = currentColors.filter((_, i) => i !== index);

        const updatedProject = {
            ...project,
            secondaryColors: updatedColors,
            updatedAt: new Date().toISOString()
        };

        updateProject(updatedProject);
    };

    const addIconToProject = (icon: Icon, shouldFavorite: boolean = false) => {
        if (!currentProject) return;

        let updatedProject = {
            ...currentProject,
            customIcons: [...(currentProject.customIcons || []), icon],
            updatedAt: new Date().toISOString()
        };

        if (shouldFavorite) {
            updatedProject.favorites = [...updatedProject.favorites, icon.id];
        }

        updateProject(updatedProject);
    };

    const deleteIconFromProject = (iconId: string) => {
        if (!currentProject) return;

        const updatedProject = {
            ...currentProject,
            customIcons: (currentProject.customIcons || []).filter(i => i.id !== iconId),
            favorites: currentProject.favorites.filter(id => id !== iconId),
            updatedAt: new Date().toISOString()
        };

        updateProject(updatedProject);
    };

    return (
        <ProjectContext.Provider value={{
            projects,
            currentProject,
            createProject,
            renameProject,
            duplicateProject,
            switchProject,
            deleteProject,
            updateProject,
            toggleFavorite,
            addSecondaryColor,
            updateSecondaryColor,
            removeSecondaryColor,
            addIconToProject,
            deleteIconFromProject
        }}>
            {children}
        </ProjectContext.Provider>
    );
}

export function useProject() {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error("useProject must be used within a ProjectProvider");
    }
    return context;
}
