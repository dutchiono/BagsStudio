'use client';

import { useEffect, useState, useRef } from 'react';
import { ImageIcon, RefreshCw, Download, Upload, Tag, X } from 'lucide-react';
import DraggableWindow from './DraggableWindow';

interface MediaFile {
    name: string;
    path: string;
    url: string;
    size: number;
    type: string;
    role?: string;
}

interface MediaWindowProps {
    projectId: string | null;
    isOpen: boolean;
    onClose: () => void;
    apiUrl: string;
}

const MEDIA_ROLES = [
    { value: '', label: 'Unassigned' },
    { value: 'logo', label: 'Logo' },
    { value: 'banner', label: 'Banner' },
    { value: 'mascot', label: 'Mascot' },
    { value: 'icon', label: 'Icon' },
    { value: 'background', label: 'Background' },
    { value: 'other', label: 'Other' },
];

export default function MediaWindow({ projectId, isOpen, onClose, apiUrl }: MediaWindowProps) {
    const [media, setMedia] = useState<MediaFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [assigningRole, setAssigningRole] = useState<string | null>(null);

    const fetchMedia = async () => {
        if (!projectId) return;

        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${apiUrl}/api/projects/${projectId}/media`);
            if (!response.ok) throw new Error('Failed to fetch media');
            const data = await response.json();
            setMedia(data.media || []);
        } catch (err: any) {
            setError(err.message);
            console.error('[MediaWindow] Error fetching media:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && projectId) {
            fetchMedia();
        }
    }, [isOpen, projectId]);

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !projectId) return;

        setUploading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${apiUrl}/api/projects/${projectId}/media/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed');
            }

            // Refresh media list
            await fetchMedia();
        } catch (err: any) {
            setError(err.message);
            console.error('[MediaWindow] Upload error:', err);
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleRoleAssign = async (filename: string, role: string) => {
        if (!projectId) return;

        setAssigningRole(filename);
        try {
            const response = await fetch(`${apiUrl}/api/projects/${projectId}/media/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, role }),
            });

            if (!response.ok) throw new Error('Failed to assign role');

            // Update local state
            setMedia(prev => prev.map(m => {
                if (m.name === filename) {
                    return { ...m, role: role || undefined };
                }
                // Remove role from other files if same role
                if (role && m.role === role) {
                    return { ...m, role: undefined };
                }
                return m;
            }));
        } catch (err: any) {
            setError(err.message);
            console.error('[MediaWindow] Role assignment error:', err);
        } finally {
            setAssigningRole(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (!file || !projectId) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);
        setError(null);

        fetch(`${apiUrl}/api/projects/${projectId}/media/upload`, {
            method: 'POST',
            body: formData,
        })
            .then(async (response) => {
                if (!response.ok) throw new Error('Upload failed');
                await fetchMedia();
            })
            .catch((err) => {
                setError(err.message);
                console.error('[MediaWindow] Upload error:', err);
            })
            .finally(() => {
                setUploading(false);
            });
    };

    return (
        <DraggableWindow
            title="MEDIA LIBRARY"
            onClose={onClose}
            defaultPosition={{
                x: typeof window !== 'undefined' && window.innerWidth < 768 ? 10 : 450,
                y: typeof window !== 'undefined' && window.innerHeight < 800 ? 550 : 650
            }}
            defaultSize={{
                width: typeof window !== 'undefined' && window.innerWidth < 768 ? window.innerWidth - 20 : 600,
                height: typeof window !== 'undefined' && window.innerHeight < 800 ? window.innerHeight - 100 : 500
            }}
            zIndex={20}
            className="!bg-black !border-2 !border-green-400 !rounded-none !shadow-[4px_4px_0px_0px_rgba(74,222,128,0.3)]"
            headerClassName="!bg-black !border-b-2 !border-green-400 !h-12"
        >
            <div className="h-full flex flex-col text-green-400 font-mono">
                {/* Toolbar */}
                <div className="flex items-center justify-between p-4 border-b border-green-400/30">
                    <div className="flex items-center gap-2">
                        <ImageIcon size={16} />
                        <span className="text-xs uppercase">Assets</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading || !projectId}
                            className="px-3 py-1 text-xs bg-green-400/10 hover:bg-green-400/20 border border-green-400/30 text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                            <Upload size={12} />
                            Upload
                        </button>
                        <button
                            onClick={fetchMedia}
                            disabled={loading}
                            className="p-1 hover:bg-green-400/10 transition-colors disabled:opacity-50"
                            title="Refresh"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>

                {/* Upload Area */}
                <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className={`p-4 border-b-2 border-green-400/30 ${uploading ? 'bg-green-400/10' : 'bg-green-400/5'}`}
                >
                    <div className="text-center text-xs text-green-400/70">
                        {uploading ? (
                            <div className="flex items-center justify-center gap-2">
                                <RefreshCw size={14} className="animate-spin" />
                                <span>Uploading...</span>
                            </div>
                        ) : (
                            <span>Drag & drop files here or click Upload</span>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading && media.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-green-400/50">
                            <RefreshCw size={20} className="animate-spin mr-2" />
                            <span>Loading media...</span>
                        </div>
                    ) : error ? (
                        <div className="text-red-400 text-sm p-2 bg-red-400/10 border border-red-400/30">
                            Error: {error}
                        </div>
                    ) : media.length === 0 ? (
                        <div className="text-center text-green-400/50 py-8">
                            <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No media files found</p>
                            <p className="text-xs mt-1">Upload files or generate branding to get started</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {media.map((file) => (
                                <div
                                    key={file.path}
                                    className="border border-green-400/30 bg-green-400/5 p-2 hover:bg-green-400/10 transition-colors"
                                >
                                    <div className="aspect-square bg-green-400/5 mb-2 flex items-center justify-center overflow-hidden rounded">
                                        {file.type === 'svg' || file.type === 'png' || file.type === 'jpg' || file.type === 'jpeg' || file.type === 'webp' ? (
                                            <img
                                                src={`${apiUrl}${file.url}`}
                                                alt={file.name}
                                                className="max-w-full max-h-full object-contain"
                                            />
                                        ) : (
                                            <ImageIcon size={32} className="text-green-400/30" />
                                        )}
                                    </div>
                                    <div className="text-xs space-y-2">
                                        <div className="font-bold truncate" title={file.name}>
                                            {file.name}
                                        </div>
                                        <div className="text-green-400/50">
                                            {formatFileSize(file.size)} • {file.type.toUpperCase()}
                                        </div>

                                        {/* Role Assignment */}
                                        <div className="flex gap-1">
                                            <select
                                                value={file.role || ''}
                                                onChange={(e) => handleRoleAssign(file.name, e.target.value)}
                                                disabled={assigningRole === file.name}
                                                className="flex-1 px-2 py-1 bg-black border border-green-400/30 text-green-400 text-xs focus:outline-none focus:border-green-400 disabled:opacity-50"
                                            >
                                                {MEDIA_ROLES.map(role => (
                                                    <option key={role.value} value={role.value}>
                                                        {role.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <a
                                                href={`${apiUrl}${file.url}`}
                                                download
                                                className="px-2 py-1 bg-green-400/10 hover:bg-green-400/20 border border-green-400/30 text-center transition-colors"
                                                title="Download"
                                            >
                                                <Download size={12} />
                                            </a>
                                        </div>

                                        {/* Role Badge */}
                                        {file.role && (
                                            <div className="text-[10px] text-green-400/70 bg-green-400/10 px-2 py-0.5 rounded inline-block">
                                                {MEDIA_ROLES.find(r => r.value === file.role)?.label || file.role}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t-2 border-green-400/30 p-4 text-xs text-green-400/50">
                    {media.length > 0 && (
                        <div className="flex justify-between items-center">
                            <span>{media.length} file{media.length !== 1 ? 's' : ''}</span>
                            <span>{formatFileSize(media.reduce((sum, f) => sum + f.size, 0))} total</span>
                            {media.filter(m => m.role).length > 0 && (
                                <span className="text-green-400/70">
                                    {media.filter(m => m.role).length} assigned
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DraggableWindow>
    );
}
