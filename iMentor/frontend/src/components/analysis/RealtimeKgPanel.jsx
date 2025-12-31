// frontend/src/components/analysis/RealtimeKgPanel.jsx
import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, { MiniMap, Controls, Background, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import api from '../../services/api.js';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import IconButton from '../core/IconButton.jsx';

const layoutNodes = (nodes, edges) => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const childrenMap = new Map();
    edges.forEach(edge => {
        if (!childrenMap.has(edge.source)) childrenMap.set(edge.source, []);
        childrenMap.get(edge.source).push(edge.target);
    });

    const positionedNodes = new Set();

    const positionNode = (nodeId, x, level) => {
        if (positionedNodes.has(nodeId)) return;
        const node = nodeMap.get(nodeId);
        if (!node) return;
        
        node.position = { x: x + (Math.random() * 50 - 25), y: level * 150 };
        positionedNodes.add(nodeId);
        
        const children = childrenMap.get(nodeId) || [];
        const childWidth = children.length > 0 ? 300 * children.length : 0;
        let currentX = x - childWidth / 2 + 150;

        children.forEach(childId => {
            positionNode(childId, currentX, level + 1);
            currentX += 300;
        });
    };
    
    const targetNodes = new Set(edges.map(e => e.target));
    const rootNodes = nodes.filter(n => !targetNodes.has(n.id));
    
    let currentX = 0;
    rootNodes.forEach(root => {
        positionNode(root.id, currentX, 0);
        currentX += (childrenMap.get(root.id)?.length || 1) * 300;
    });

    return nodes;
};

const RealtimeKgPanel = () => {
    const { currentSessionId } = useAppState();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchAndLayoutGraph = useCallback(async () => {
        if (!currentSessionId) {
            setError("No active session found.");
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const graphData = await api.getSessionKnowledgeGraph(currentSessionId);
            if (graphData && graphData.nodes && graphData.edges) {
                if (graphData.nodes.length === 0) {
                     setNodes([]);
                     setEdges([]);
                     return;
                }
                const reactFlowNodes = graphData.nodes.map(n => ({
                    id: n.id,
                    data: { label: n.id },
                    position: { x: 0, y: 0 }
                }));
                const reactFlowEdges = graphData.edges.map((e, i) => ({
                    id: `e${i}-${e.from}-${e.to}`,
                    source: e.from,
                    target: e.to,
                    label: e.relationship.replace(/_/g, ' '),
                    animated: true
                }));
                
                const laidOutNodes = layoutNodes(reactFlowNodes, reactFlowEdges);
                setNodes(laidOutNodes);
                setEdges(reactFlowEdges);
            }
        } catch (err) {
            setError(err.message || 'Failed to fetch knowledge graph.');
        } finally {
            setIsLoading(false);
        }
    }, [currentSessionId, setNodes, setEdges]);

    useEffect(() => {
        fetchAndLayoutGraph();
    }, [fetchAndLayoutGraph]);

    // The component now returns the graph canvas directly, without extra headers or borders.
    return (
        <div className="h-full w-full relative bg-gray-50 dark:bg-gray-800/50 rounded-md">
            {isLoading && <Loader2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-primary z-10" />}
            {error && <div className="p-4 text-center text-red-500 text-sm"><AlertTriangle className="mx-auto mb-2"/>{error}</div>}
            
            {!isLoading && !error && nodes.length === 0 && (
                <div className="flex items-center justify-center h-full text-center text-text-muted-light dark:text-text-muted-dark">
                    <p>No concepts have been mapped from this conversation yet. <br/> Continue chatting to build the map!</p>
                </div>
            )}

            {!isLoading && !error && nodes.length > 0 && (
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    fitView
                    className="bg-background-light dark:bg-background-dark"
                >
                    <Controls />
                    <MiniMap />
                    <Background variant="dots" gap={12} size={1} />
                </ReactFlow>
            )}
             <IconButton 
                icon={RefreshCw} 
                onClick={fetchAndLayoutGraph} 
                size="sm" 
                title="Refresh Graph" 
                isLoading={isLoading}
                className="absolute top-2 right-2 z-10 bg-surface-light dark:bg-surface-dark shadow-md"
            />
        </div>
    );
};

export default RealtimeKgPanel;