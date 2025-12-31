// frontend/src/components/analysis/MindmapViewer.jsx
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import toast from 'react-hot-toast';
import { escapeHtml } from '../../utils/helpers.js';

const MindmapViewer = forwardRef(({ mermaidCode }, ref) => {
    const svgContainerRef = useRef(null);
    const [error, setError] = useState(null);
    const [isMermaidReady, setIsMermaidReady] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [uniqueId] = useState(() => `mermaid-graph-${Math.random().toString(36).substr(2, 9)}`);

    useImperativeHandle(ref, () => ({
        getSvgElement: () => {
            return svgContainerRef.current?.querySelector('svg');
        }
    }));

    useEffect(() => {
        if (typeof window.mermaid !== 'undefined') {
            setIsMermaidReady(true);
        } else {
            const intervalId = setInterval(() => {
                if (typeof window.mermaid !== 'undefined') {
                    setIsMermaidReady(true);
                    clearInterval(intervalId);
                }
            }, 100);
            return () => clearInterval(intervalId);
        }
    }, []);

    useEffect(() => {
        if (!isMermaidReady || !mermaidCode || !svgContainerRef.current) {
            if (svgContainerRef.current) svgContainerRef.current.innerHTML = '';
            setError(null);
            setIsLoading(false);
            return;
        }

        const renderMermaidDiagram = async () => {
            setIsLoading(true);
            setError(null);
            if (!svgContainerRef.current) {
                setIsLoading(false);
                return;
            }
            svgContainerRef.current.innerHTML = '<div class="flex justify-center items-center h-full w-full text-sm text-text-muted-light dark:text-text-muted-dark"><div class="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary mr-2"></div>Rendering diagram...</div>';
            
            let codeToRender = mermaidCode.trim();
            
            // --- THIS IS THE FIX ---
            // New, more robust regex to find the diagram code.
            // It looks for a code block that CONTAINS a known diagram type (e.g., 'graph', 'mindmap').
            // It is no longer anchored to the start (^) of the string, so it can find the
            // block even if there's leading garbage or extra backticks from the LLM.
            const fenceRegex = /```(?:mermaid)?\s*([\s\S]*?(?:graph|mindmap|flowchart|sequenceDiagram)[\s\S]*?)\s*```/i;
            const match = codeToRender.match(fenceRegex);

            if (match && match[1]) {
                // If we found a fenced block, use its content.
                codeToRender = match[1].trim();
            } else {
                // Fallback for cases where LLM might forget the fences entirely.
                // We still trim to remove potential whitespace.
                codeToRender = codeToRender.trim();
            }
            // --- END OF FIX ---

            try {
                if (typeof window.mermaid === 'undefined') {
                    throw new Error("Mermaid library failed to load or initialize properly.");
                }

                const { svg, bindFunctions } = await window.mermaid.render(uniqueId, codeToRender);
                
                if (svgContainerRef.current) {
                    svgContainerRef.current.innerHTML = svg;
                    if (bindFunctions) {
                        bindFunctions(svgContainerRef.current);
                    }
                    const svgElement = svgContainerRef.current.querySelector('svg');
                    if (svgElement) {
                        svgElement.style.width = '100%';
                        svgElement.style.height = 'auto'; 
                        svgElement.style.maxWidth = '100%'; 
                        svgElement.style.display = 'block';
                    }
                }
            } catch (e) {
                console.error("Error rendering Mermaid diagram with input:", codeToRender, e);
                const errorMsg = e.message || "Failed to render mind map. Invalid Mermaid syntax?";
                setError(errorMsg);
                if (svgContainerRef.current) {
                    const codeSnippet = escapeHtml(codeToRender.substring(0, 200) + (codeToRender.length > 200 ? "..." : ""));
                    svgContainerRef.current.innerHTML = `<div class="p-4 text-center text-red-500 dark:text-red-400 text-xs break-all"><strong>Error rendering:</strong> ${escapeHtml(errorMsg)}<br><strong class='mt-2 block'>Input Code (first 200 chars):</strong><pre class='text-left text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1 whitespace-pre-wrap'>${codeSnippet}</pre></div>`;
                }
            } finally {
                setIsLoading(false);
            }
        };

        const timer = setTimeout(renderMermaidDiagram, 100); 
        return () => clearTimeout(timer);
        
    }, [mermaidCode, uniqueId, isMermaidReady]);

    if (!isMermaidReady && !error) {
      return <div className="p-4 text-center text-text-muted-light dark:text-text-muted-dark text-xs">Waiting for Mermaid.js library...</div>;
    }
    if (error && (!isLoading || (svgContainerRef.current && svgContainerRef.current.innerHTML.includes('Error rendering')))) {
        return <div ref={svgContainerRef} className="mermaid-diagram-render-area w-full h-full flex justify-center items-center bg-gray-50 dark:bg-gray-800/50 p-2 rounded-md">
                {/* Error message will be injected by useEffect's catch block */}
               </div>;
    }
    
    if (isLoading) { 
         return <div ref={svgContainerRef} className="mermaid-diagram-render-area w-full h-full flex justify-center items-center bg-gray-50 dark:bg-gray-800/50 p-2 rounded-md">
            {/* Loading message is set by renderMermaidDiagram's initial innerHTML write */}
         </div>;
    }

    if (!mermaidCode && !error && isMermaidReady) { 
        return <p className="text-xs text-center text-text-muted-light dark:text-text-muted-dark p-4">No mind map data to display.</p>;
    }
    
    return (
        <div 
            ref={svgContainerRef} 
            className="mermaid-diagram-render-area w-full h-full flex justify-center items-center bg-gray-50 dark:bg-gray-800/50 p-2 rounded-md"
        >

        </div>
    );
});

export default MindmapViewer;
