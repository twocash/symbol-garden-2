export interface GitHubFile {
    name: string;
    path: string;
    sha: string;
    size: number;
    url: string;
    html_url: string;
    git_url: string;
    download_url: string;
    type: "file" | "dir";
}

const BASE_URL = "https://api.github.com";

export async function fetchRepoContents(owner: string, repo: string, path: string = ""): Promise<GitHubFile[]> {
    const url = `${BASE_URL}/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url, {
        headers: {
            "Accept": "application/vnd.github.v3+json",
        },
    });

    if (!response.ok) {
        throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

export async function fetchRawFile(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
    }
    return response.text();
}
