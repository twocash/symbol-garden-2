import { nanoid } from 'nanoid';
import { StyleSummary } from './style-analysis';

/**
 * GenerationEvent represents a single icon generation attempt.
 * Stores all context needed to analyze and improve the generation system.
 */
export interface GenerationEvent {
    id: string;                    // Unique event ID (nanoid)
    workspaceId: string;            // Which workspace generated this
    timestamp: number;              // Unix timestamp (ms)
    userPrompt: string;             // Original user input
    styleSummary: StyleSummary;     // Computed style profile
    styleStrictness: number;        // 0-100 strictness level
    generatedVariants: number;      // How many variants were generated (e.g., 4)
    selectedVariantIndex: number | null;  // Which variant was chosen (0-3, or null if none)
    savedIconId: string | null;     // ID of the saved icon in the workspace
    rating: number | null;          // User rating 1-5 stars (set after save)
}

const STORAGE_KEY_PREFIX = 'sprout_telemetry_';
const MAX_EVENTS_PER_WORKSPACE = 100;

/**
 * Logs a new generation attempt. Returns the event ID.
 * 
 * @param event - Generation event details (without id and timestamp)
 * @returns Event ID (nanoid)
 * 
 * @example
 * ```ts
 * const eventId = logGeneration({
 *   workspaceId: 'workspace-123',
 *   userPrompt: 'battery with lightning bolt',
 *   styleSummary,
 *   styleStrictness: 70,
 *   generatedVariants: 4,
 *   selectedVariantIndex: null,
 *   savedIconId: null,
 *   rating: null
 * });
 * ```
 */
export function logGeneration(
    event: Omit<GenerationEvent, 'id' | 'timestamp'>
): string {
    const id = nanoid();
    const timestamp = Date.now();

    const fullEvent: GenerationEvent = {
        ...event,
        id,
        timestamp,
    };

    // Get existing events for this workspace
    const events = getEventsForWorkspace(event.workspaceId);

    // Add new event
    events.push(fullEvent);

    // Enforce FIFO limit
    if (events.length > MAX_EVENTS_PER_WORKSPACE) {
        events.shift(); // Remove oldest event
    }

    // Save back to localStorage
    saveEventsForWorkspace(event.workspaceId, events);

    console.log(`[Telemetry] Logged generation event ${id} for workspace ${event.workspaceId}`);

    return id;
}

/**
 * Updates an event when the user selects and saves a variant.
 * 
 * @param eventId - The event ID to update
 * @param selectedIndex - Index of the selected variant (0-3)
 * @param savedIconId - ID of the saved icon in the workspace
 */
export function updateSelection(
    eventId: string,
    selectedIndex: number,
    savedIconId: string
): void {
    const event = findEventById(eventId);

    if (!event) {
        console.warn(`[Telemetry] Event ${eventId} not found, cannot update selection`);
        return;
    }

    event.selectedVariantIndex = selectedIndex;
    event.savedIconId = savedIconId;

    // Save updated event
    const workspaceId = event.workspaceId;
    const events = getEventsForWorkspace(workspaceId);
    const index = events.findIndex(e => e.id === eventId);

    if (index !== -1) {
        events[index] = event;
        saveEventsForWorkspace(workspaceId, events);
        console.log(`[Telemetry] Updated event ${eventId}: selected variant ${selectedIndex}`);
    }
}

/**
 * Updates an event when the user rates the generated icon.
 * 
 * @param eventId - The event ID to update
 * @param rating - User rating (1-5 stars)
 */
export function updateRating(
    eventId: string,
    rating: number
): void {
    if (rating < 1 || rating > 5) {
        console.error('[Telemetry] Rating must be between 1 and 5');
        return;
    }

    const event = findEventById(eventId);

    if (!event) {
        console.warn(`[Telemetry] Event ${eventId} not found, cannot update rating`);
        return;
    }

    event.rating = rating;

    // Save updated event
    const workspaceId = event.workspaceId;
    const events = getEventsForWorkspace(workspaceId);
    const index = events.findIndex(e => e.id === eventId);

    if (index !== -1) {
        events[index] = event;
        saveEventsForWorkspace(workspaceId, events);
        console.log(`[Telemetry] Updated event ${eventId}: rated ${rating} stars`);
    }
}

/**
 * Retrieves generation history for a workspace.
 * 
 * @param workspaceId - Workspace ID
 * @param limit - Optional limit on number of events to return (most recent first)
 * @returns Array of generation events, sorted by timestamp (newest first)
 */
export function getGenerationHistory(
    workspaceId: string,
    limit?: number
): GenerationEvent[] {
    const events = getEventsForWorkspace(workspaceId);

    // Sort by timestamp descending (newest first)
    events.sort((a, b) => b.timestamp - a.timestamp);

    return limit ? events.slice(0, limit) : events;
}

/**
 * Calculates the average user rating for a workspace.
 * Only includes events that have been rated.
 * 
 * @param workspaceId - Workspace ID
 * @returns Average rating (0-5), or 0 if no ratings exist
 */
export function getAverageRating(workspaceId: string): number {
    const events = getEventsForWorkspace(workspaceId);
    const ratedEvents = events.filter(e => e.rating !== null && e.rating !== undefined);

    if (ratedEvents.length === 0) return 0;

    const sum = ratedEvents.reduce((acc, e) => acc + (e.rating || 0), 0);
    return sum / ratedEvents.length;
}

/**
 * Gets aggregate statistics for a workspace.
 */
export function getWorkspaceStats(workspaceId: string): {
    totalGenerations: number;
    totalRated: number;
    averageRating: number;
    averageStrictness: number;
    mostCommonPrompts: string[];
} {
    const events = getEventsForWorkspace(workspaceId);
    const ratedEvents = events.filter(e => e.rating !== null);

    // Calculate average strictness
    const avgStrictness = events.length > 0
        ? events.reduce((sum, e) => sum + e.styleStrictness, 0) / events.length
        : 50;

    // Find most common prompts
    const promptCounts: Record<string, number> = {};
    events.forEach(e => {
        const prompt = e.userPrompt.toLowerCase();
        promptCounts[prompt] = (promptCounts[prompt] || 0) + 1;
    });

    const mostCommonPrompts = Object.entries(promptCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([prompt]) => prompt);

    return {
        totalGenerations: events.length,
        totalRated: ratedEvents.length,
        averageRating: getAverageRating(workspaceId),
        averageStrictness: Math.round(avgStrictness),
        mostCommonPrompts,
    };
}

/**
 * Clears all telemetry data for a workspace.
 * Useful for testing or privacy compliance.
 */
export function clearWorkspaceTelemetry(workspaceId: string): void {
    const key = STORAGE_KEY_PREFIX + workspaceId;
    localStorage.removeItem(key);
    console.log(`[Telemetry] Cleared all data for workspace ${workspaceId}`);
}

/**
 * Clears all telemetry data across all workspaces.
 * WARNING: This is irreversible!
 */
export function clearAllTelemetry(): void {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`[Telemetry] Cleared all telemetry data (${keysToRemove.length} workspaces)`);
}

// ============================================================================
// Private Helper Functions
// ============================================================================

/**
 * Retrieves events from localStorage for a specific workspace.
 */
function getEventsForWorkspace(workspaceId: string): GenerationEvent[] {
    const key = STORAGE_KEY_PREFIX + workspaceId;
    const data = localStorage.getItem(key);

    if (!data) return [];

    try {
        return JSON.parse(data) as GenerationEvent[];
    } catch (error) {
        console.error('[Telemetry] Failed to parse events from localStorage:', error);
        return [];
    }
}

/**
 * Saves events to localStorage for a specific workspace.
 */
function saveEventsForWorkspace(workspaceId: string, events: GenerationEvent[]): void {
    const key = STORAGE_KEY_PREFIX + workspaceId;

    try {
        localStorage.setItem(key, JSON.stringify(events));
    } catch (error) {
        console.error('[Telemetry] Failed to save events to localStorage:', error);

        // If quota exceeded, try removing oldest events
        if (error instanceof Error && error.name === 'QuotaExceededError') {
            console.warn('[Telemetry] Storage quota exceeded, removing old events...');
            const reducedEvents = events.slice(-50); // Keep only 50 most recent
            localStorage.setItem(key, JSON.stringify(reducedEvents));
        }
    }
}

/**
 * Finds an event by ID across all workspaces.
 */
function findEventById(eventId: string): GenerationEvent | null {
    // Search through all workspace keys
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(STORAGE_KEY_PREFIX)) continue;

        const events = getEventsForWorkspace(key.replace(STORAGE_KEY_PREFIX, ''));
        const event = events.find(e => e.id === eventId);

        if (event) return event;
    }

    return null;
}
