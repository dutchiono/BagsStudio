import { ProjectConfig, TokenProject } from '@bagsstudio/shared';
import GeneratedPage from '@/components/GeneratedPage';

async function getProjectData(id: string): Promise<TokenProject | null> {
    // Fetch from Builder Service
    const apiUrl = process.env.BUILDER_API_URL || 'http://localhost:3042';
    try {
        const res = await fetch(`${apiUrl}/api/projects/${id}`, { cache: 'no-store' });
        if (!res.ok) {
            console.error('Failed to fetch project:', res.status, res.statusText);
            return null;
        }
        const data = await res.json();
        // data has { project, config, ... }
        // We want the content from the config
        if (data.config && data.config.content) {
            return data.config.content;
        }
        return null;
    } catch (e) {
        console.error('Error fetching project:', e);
        return null;
    }
}

export default async function UserProjectPage({
    params,
}: {
    params: Promise<{ username: string; id: string }>
}) {
    // We strictly use the ID to lookup the project. 
    // The username is part of the URL structure for vanity/organization but the ID is the source of truth.
    const { id } = await params;

    const project = await getProjectData(id);

    if (!project) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-pink-50 text-pink-900 font-bold font-bungee">
                <div className="text-center">
                    <h1 className="text-4xl mb-4">404 - Slop Not Found</h1>
                    <p>The machine is empty or the API is down.</p>
                </div>
            </div>
        )
    }

    return <GeneratedPage project={project} />;
}
