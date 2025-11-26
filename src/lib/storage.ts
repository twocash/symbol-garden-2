import { get, set, del } from 'idb-keyval';
import { Icon } from '@/types/schema';

const STORE_KEY = 'ingested_icons';

export async function getIngestedIcons(): Promise<Icon[]> {
    try {
        const icons = await get<Icon[]>(STORE_KEY);
        return icons || [];
    } catch (error) {
        console.error("Failed to load icons from IndexedDB:", error);
        return [];
    }
}

export async function saveIngestedIcons(icons: Icon[]): Promise<void> {
    try {
        await set(STORE_KEY, icons);
    } catch (error) {
        console.error("Failed to save icons to IndexedDB:", error);
        throw error;
    }
}

export async function clearIngestedIcons(): Promise<void> {
    try {
        await del(STORE_KEY);
    } catch (error) {
        console.error("Failed to clear icons from IndexedDB:", error);
        throw error;
    }
}

const PROJECTS_KEY = 'projects';

export async function getProjects(): Promise<any[]> {
    try {
        const projects = await get<any[]>(PROJECTS_KEY);
        return projects || [];
    } catch (error) {
        console.error("Failed to load projects from IndexedDB:", error);
        return [];
    }
}

export async function saveProjectsToIDB(projects: any[]): Promise<void> {
    try {
        await set(PROJECTS_KEY, projects);
    } catch (error) {
        console.error("Failed to save projects to IndexedDB:", error);
        throw error;
    }
}

const SOURCES_KEY = 'icon_sources';

export async function getIconSources(): Promise<any[]> {
    try {
        const sources = await get<any[]>(SOURCES_KEY);
        return sources || [];
    } catch (error) {
        console.error("Failed to load icon sources from IndexedDB:", error);
        return [];
    }
}

export async function saveIconSources(sources: any[]): Promise<void> {
    try {
        await set(SOURCES_KEY, sources);
    } catch (error) {
        console.error("Failed to save icon sources to IndexedDB:", error);
        throw error;
    }
}
