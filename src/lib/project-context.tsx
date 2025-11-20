"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Project } from "@/types/schema";

interface ProjectContextType {
    projects: Project[];
    currentProject: Project | null;
    createProject: (name: string) => void;
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
            setProjects(parsedProjects);

            if (storedCurrentId && parsedProjects.find((p: Project) => p.id === storedCurrentId)) {
                setCurrentProjectId(storedCurrentId);
            } else if (parsedProjects.length > 0) {
                setCurrentProjectId(parsedProjects[0].id);
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
    }, []);

    const currentProject = projects.find(p => p.id === currentProjectId) || null;

    const saveProjects = (newProjects: Project[]) => {
        setProjects(newProjects);
        localStorage.setItem("projects", JSON.stringify(newProjects));
    };

    const createProject = (name: string) => {
        const newProject: Project = {
            id: Date.now().toString(),
            name,
            slug: name.toLowerCase().replace(/\s+/g, "-"),
            primaryLibrary: "all",
            fallbackLibraries: [],
            icons: {},
            favorites: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        const updatedProjects = [...projects, newProject];
        saveProjects(updatedProjects);
        switchProject(newProject.id);
    };

    const switchProject = (projectId: string) => {
        setCurrentProjectId(projectId);
        localStorage.setItem("currentProjectId", projectId);
    };

    const deleteProject = (projectId: string) => {
        const updatedProjects = projects.filter(p => p.id !== projectId);
        saveProjects(updatedProjects);

        if (currentProjectId === projectId) {
            const nextProject = updatedProjects[0] || null;
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
