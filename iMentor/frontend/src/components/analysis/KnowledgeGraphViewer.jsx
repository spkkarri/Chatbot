// frontend/src/components/analysis/KnowledgeGraphViewer.jsx
import React, { useEffect, useState, useMemo } from 'react';
import Graph from 'react-vis-network-graph';
import { Loader2, AlertTriangle, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import IconButton from '../core/IconButton.jsx';

const KnowledgeGraphViewer = ({ graphData }) => {
    const { theme } = useTheme();

    // --- FIX START: Add state to hold the network instance ---
    const [network, setNetwork] = useState(null);
    // --- FIX END ---

    // Memoize options to prevent re-renders
    const options = useMemo(() => {
        const isDark = theme === 'dark';
        return {
            layout: {
                hierarchical: {
                    enabled: true,
                    direction: 'UD', // Up-Down
                    sortMethod: 'directed',
                    levelSeparation: 150,
                    nodeSpacing: 200,
                },
            },
            nodes: {
                shape: 'box',
                borderWidth: 1.5,
                font: {
                    color: isDark ? '#E2E8F0' : '#0F172A',
                    size: 14,
                    face: 'Inter',
                },
                color: {
                    border: isDark ? '#4B5563' : '#9CA3AF',
                    background: isDark ? '#1E293B' : '#FFFFFF',
                    highlight: {
                        border: '#3b82f6',
                        background: isDark ? '#2563eb' : '#60a5fa',
                    },
                },
                shadow: true,
            },
            edges: {
                color: {
                    color: isDark ? '#64748B' : '#9CA3AF',
                    highlight: '#3b82f6',
                },
                arrows: {
                    to: { enabled: true, scaleFactor: 0.7 },
                },
                font: {
                    color: isDark ? '#94A3B8' : '#6B7280',
                    size: 10,
                    align: 'middle',
                    strokeWidth: 2,
                    strokeColor: isDark ? '#1E293B' : '#FFFFFF',
                },
                smooth: {
                    type: 'cubicBezier',
                    forceDirection: 'vertical',
                    roundness: 0.4,
                },
            },
            physics: {
                enabled: true,
                hierarchicalRepulsion: {
                    centralGravity: 0.0,
                    springLength: 100,
                    springConstant: 0.01,
                    nodeDistance: 200,
                    damping: 0.09,
                },
                solver: 'hierarchicalRepulsion',
            },
            interaction: {
                dragNodes: true,
                dragView: true,
                zoomView: true,
                tooltipDelay: 200,
            },
            height: '100%',
            width: '100%',
        };
    }, [theme]);

    const formattedGraph = useMemo(() => {
        if (!graphData || !graphData.nodes || !graphData.edges) {
            return { nodes: [], edges: [] };
        }
        const nodes = graphData.nodes.map(node => ({
            id: node.id,
            label: node.id,
            title: `Type: ${node.type}\nParent: ${node.parent || 'N/A'}\n\n${node.description}`,
            color: node.type === 'major' 
                ? { border: '#3b82f6', background: theme === 'dark' ? '#1E3A8A' : '#BFDBFE' } 
                : undefined,
        }));
        const edges = graphData.edges.map(edge => ({
            from: edge.from,
            to: edge.to,
            label: edge.relationship.replace(/_/g, ' '),
        }));
        return { nodes, edges };
    }, [graphData, theme]);

    // --- FIX START: These handlers will now work because 'network' is in state ---
    const handleZoomIn = () => network?.zoomIn();
    const handleZoomOut = () => network?.zoomOut();
    const handleFit = () => network?.fit();
    // --- FIX END ---

    if (!graphData) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-primary mr-2" /> Loading graph data...
            </div>
        );
    }

    if (graphData.error) {
        return (
             <div className="flex flex-col items-center justify-center h-full text-red-500">
                <AlertTriangle size={32} className="mb-2" />
                <p className="font-semibold">Failed to load Knowledge Graph</p>
                <p className="text-xs">{graphData.error}</p>
            </div>
        );
    }
    
    if (formattedGraph.nodes.length === 0) {
        return (
             <div className="flex flex-col items-center justify-center h-full text-text-muted-light dark:text-text-muted-dark">
                <AlertTriangle size={32} className="mb-2" />
                <p>No graph data found for this document.</p>
             </div>
        );
    }

    return (
        <div className="relative w-full h-[70vh] border border-border-light dark:border-border-dark rounded-md bg-gray-50 dark:bg-gray-800/50">
            <Graph
                key={theme}
                graph={formattedGraph}
                options={options}
                // --- FIX START: Use the 'getNetwork' callback to update our state ---
                getNetwork={net => setNetwork(net)}
                // --- FIX END ---
            />
            <div className="absolute top-2 right-2 flex flex-col gap-1.5 bg-surface-light dark:bg-surface-dark p-1.5 rounded-md shadow-lg border border-border-light dark:border-border-dark">
                <IconButton icon={ZoomIn} onClick={handleZoomIn} title="Zoom In" size="sm" />
                <IconButton icon={ZoomOut} onClick={handleZoomOut} title="Zoom Out" size="sm" />
                <IconButton icon={Maximize} onClick={handleFit} title="Fit to View" size="sm" />
            </div>
        </div>
    );
};

export default KnowledgeGraphViewer;