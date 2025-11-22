"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Project } from "@/types/schema";
import { nanoid } from "nanoid";

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
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

    // Load projects from localStorage on mount
    useEffect(() => {
        const storedProjects = localStorage.getItem("projects");
        const storedCurrentId = localStorage.getItem("currentProjectId");

        if (storedProjects) {
            const parsedProjects = JSON.parse(storedProjects);
            // Filter out soft-deleted projects
            const activeProjects = parsedProjects.filter((p: Project) => !p.deletedAt);
            setProjects(activeProjects);

            if (storedCurrentId && activeProjects.find((p: Project) => p.id === storedCurrentId)) {
                setCurrentProjectId(storedCurrentId);
            } else if (activeProjects.length > 0) {
                setCurrentProjectId(activeProjects[0].id);
            }
        } else {
            // Create default project if none exist
            const defaultProject: Project = {
                id: "default",
                name: "Default Project",
                slug: "default-project",
                primaryLibrary: "all",
                fallbackLibraries: [],
                icons: {},
                favorites: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            setProjects([defaultProject]);
            setCurrentProjectId("default");
            localStorage.setItem("projects", JSON.stringify([defaultProject]));
            localStorage.setItem("currentProjectId", "default");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const currentProject = projects.find(p => p.id === currentProjectId) || null;

    const saveProjects = (newProjects: Project[]) => {
        setProjects(newProjects);
        localStorage.setItem("projects", JSON.stringify(newProjects));
    };

    const createProject = (name: string) => {
        const newProject: Project = {
            id: nanoid(),
            name,
            slug: name.toLowerCase().replace(/\s+/g, "-"),
            primaryLibrary: "all",
            fallbackLibraries: [],
            icons: {},
            favorites: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setProjects(prev => {
            const updated = [...prev, newProject];
            localStorage.setItem("projects", JSON.stringify(updated));
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
            favorites: copyFavorites ? [...source.favorites] : [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setProjects(prev => {
            const updated = [...prev, newProject];
            localStorage.setItem("projects", JSON.stringify(updated));
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
            toggleFavorite
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
