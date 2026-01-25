import { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Position {
    x: number;
    y: number;
}

interface Size {
    width: number;
    height: number;
}

interface DraggableGlassWindowProps {
    title: string;
    children: ReactNode;
    defaultPosition?: Position;
    defaultSize?: Size;
    minWidth?: number;
    minHeight?: number;
    onClose?: () => void;
    zIndex?: number;
    onFocus?: () => void;
    className?: string;
    headerClassName?: string;
}

export default function DraggableWindow({
    title,
    children,
    defaultPosition = { x: 100, y: 100 },
    defaultSize = { width: 400, height: 500 },
    minWidth = 300,
    minHeight = 200,
    onClose,
    zIndex = 10,
    onFocus,
    className = '',
    headerClassName = '',
}: DraggableGlassWindowProps) {
    // Basic state
    const [mounted, setMounted] = useState(false);
    const [position, setPosition] = useState<Position>(defaultPosition);
    const [size, setSize] = useState<Size>(defaultSize);
    const [isMinimized, setIsMinimized] = useState(false);

    // Drag state
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });

    // Resize state
    const [isResizing, setIsResizing] = useState(false);
    const [resizeStart, setResizeStart] = useState<{ pos: Position; size: Size } | null>(null);

    const windowRef = useRef<HTMLDivElement>(null);

    // Prevent hydration issues by only rendering after mount
    useEffect(() => {
        setMounted(true);
    }, []);

    // Ensure window stays within viewport on resize
    useEffect(() => {
        const handleResize = () => {
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Reposition if window is off-screen
            const newX = Math.max(0, Math.min(position.x, viewportWidth - size.width));
            const newY = Math.max(0, Math.min(position.y, viewportHeight - 50));

            if (newX !== position.x || newY !== position.y) {
                setPosition({ x: newX, y: newY });
            }

            // Resize if window is too large for viewport
            const maxWidth = viewportWidth - 20;
            const maxHeight = viewportHeight - 100;

            if (size.width > maxWidth || size.height > maxHeight) {
                setSize({
                    width: Math.min(size.width, maxWidth),
                    height: Math.min(size.height, maxHeight),
                });
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [position, size]);

    // Drag handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        // Only trigger if clicking the header AND not a button
        if ((e.target as HTMLElement).closest('.window-header') && !(e.target as HTMLElement).closest('button')) {
            e.preventDefault();
            setIsDragging(true);
            const currentX = e.clientX;
            const currentY = e.clientY;
            setDragOffset({
                x: currentX - position.x,
                y: currentY - position.y,
            });
            onFocus?.();
        }
    };

    // Resize handlers
    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        setResizeStart({
            pos: { x: e.clientX, y: e.clientY },
            size: { ...size },
        });
        onFocus?.();
    };

    // Global event listeners for drag/resize
    useEffect(() => {
        if (!isDragging && !isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                // Ensure we stay within viewport bounds
                const newX = e.clientX - dragOffset.x;
                const newY = e.clientY - dragOffset.y;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                // Constrain to viewport
                const constrainedX = Math.max(0, Math.min(newX, viewportWidth - size.width));
                const constrainedY = Math.max(0, Math.min(newY, viewportHeight - 50)); // Leave space for header

                setPosition({ x: constrainedX, y: constrainedY });
            } else if (isResizing && resizeStart) {
                const deltaX = e.clientX - resizeStart.pos.x;
                const deltaY = e.clientY - resizeStart.pos.y;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                setSize({
                    width: Math.max(minWidth, Math.min(resizeStart.size.width + deltaX, viewportWidth - position.x)),
                    height: Math.max(minHeight, Math.min(resizeStart.size.height + deltaY, viewportHeight - position.y - 50)),
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, dragOffset, resizeStart, minWidth, minHeight]);

    if (!mounted) return null;

    // Portal to document.body to ensure no z-index/stacking context issues
    return createPortal(
        <div
            ref={windowRef}
            className="glass-window-container"
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                width: isMinimized ? 300 : size.width,
                height: isMinimized ? 'auto' : size.height,
                zIndex,
            }}
            onMouseDown={() => onFocus?.()}
        >
            <div className={`glass-panel h-full flex flex-col relative overflow-hidden backdrop-blur-2xl bg-black/40 border border-white/10 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 ${className}`}>
                {/* Header */}
                <div
                    className={`window-header h-10 flex items-center justify-between px-4 border-b border-white/10 bg-white/5 select-none cursor-grab active:cursor-grabbing ${headerClassName}`}
                    onMouseDown={handleMouseDown}
                >
                    <span className="text-sm font-medium text-white/80">{title}</span>
                    <button
                        onClick={onClose}
                        className="text-green-400 hover:text-white text-xs uppercase font-bold tracking-wider transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                {!isMinimized && (
                    <div className="flex-1 overflow-auto bg-black/20 text-white relative">
                        {children}

                        {/* Resize Handle */}
                        <div
                            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-white/10 rounded-tl transition-colors z-20"
                            onMouseDown={handleResizeStart}
                        >
                            <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-white/20" />
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
