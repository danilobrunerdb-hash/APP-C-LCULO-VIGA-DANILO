import React, { useState } from 'react';
import { CrossSectionDetails } from '../types';
import { ZoomIn, ZoomOut, Maximize, Move } from 'lucide-react';

interface ColumnLongitudinalViewerProps {
    details: CrossSectionDetails;
    height: number; // in meters
}

const ColumnLongitudinalViewer: React.FC<ColumnLongitudinalViewerProps> = ({ details, height }) => {
    const { 
        width, // Using width as the visible face width in side view
        cover, stirrupDiameter, stirrupSpacing,
        bottomBarDiameter, topBarDiameter, 
        bottomLayers, topLayers 
    } = details;

    // We assume the view shows the "Width" face. 
    // Longitudinal bars visible are those along the width distribution (bottom/top layers in section).

    // Zoom State
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

    // View Configuration
    const viewerW = 400;
    const viewerH = 500;
    const padding = 60;
    
    // Scales
    const heightCm = height * 100;
    // Fit height into viewerH
    const scaleY = (viewerH - 2 * padding) / heightCm;
    // Maintain Aspect Ratio for X?
    // Columns are narrow. Width is e.g. 20cm. Height 300cm.
    // 20cm * scaleY might be very thin.
    // Let's distort slightly or use a minimum width for visibility if scaling purely by Y makes it too thin.
    // Or just Zoom to fit.
    const scaleX = scaleY; // Keep 1:1 aspect ratio initially

    const drawW = width * scaleX;
    const drawH = heightCm * scaleY;
    
    const startX = (viewerW - drawW) / 2;
    const startY = padding; // Top
    const endY = startY + drawH; // Bottom

    // Interaction
    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        const zoomSensitivity = 0.001;
        const newScale = Math.min(Math.max(0.5, scale - e.deltaY * zoomSensitivity), 4);
        setScale(newScale);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => setIsDragging(false);
    const resetView = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

    // --- Drawing ---

    // 1. Concrete Outline
    // Rect from (startX, startY) to (startX+drawW, endY)

    // 2. Stirrups (Horizontal lines)
    const stirrups = [];
    const numStirrups = Math.floor(heightCm / stirrupSpacing);
    const stirrupOffsetCm = 5; // First stirrup offset

    for(let i=0; i<=numStirrups; i++) {
        const yCm = stirrupOffsetCm + i * stirrupSpacing;
        if(yCm > heightCm - stirrupOffsetCm) break;
        
        const y = startY + yCm * scaleY; // From top down
        
        // Draw stirrup line
        stirrups.push(
            <line key={`s-${i}`} x1={startX} y1={y} x2={startX + drawW} y2={y} stroke="#ef4444" strokeWidth="1" />
        );
    }

    // 3. Bars (Vertical lines)
    // Show only the outermost bars (corners) usually in a simplified side view, 
    // or all bars projected.
    // Let's draw bars from 'bottomLayers' (which represents one face).
    // Assuming rectangular distribution, seeing from "Front", we see bars spaced along Width.
    const bars = [];
    const numBarsX = bottomLayers[0] || 2; // At least 2 corners
    const barDia = bottomBarDiameter; // Main bar
    
    // Distribute bars along Width
    const stirrupThick = (stirrupDiameter/10) * scaleX;
    const barRad = (barDia/10/2) * scaleX;
    const coverPx = cover * scaleX;
    
    // Effective width for bars
    const effW = drawW - 2*coverPx - 2*stirrupThick - 2*barRad;
    const barStartX = startX + coverPx + stirrupThick + barRad;
    
    const spacingX = numBarsX > 1 ? effW / (numBarsX - 1) : 0;
    
    for(let i=0; i<numBarsX; i++) {
        const x = barStartX + i * spacingX;
        bars.push(
            <line 
                key={`b-${i}`} 
                x1={x} y1={startY} 
                x2={x} y2={endY} 
                stroke="#1e293b" 
                strokeWidth={Math.max(2, barRad*2)} 
                strokeLinecap="round"
            />
        );
    }

    // --- Annotations ---
    const Label = ({ x, y, text, align = 'left' }: any) => (
        <text x={x} y={y} textAnchor={align} fontSize="11" fill="#475569" fontWeight="500">{text}</text>
    );

    return (
        <div className="flex flex-col items-center w-full relative group">
             {/* Controls Overlay */}
             <div className="absolute top-4 right-4 z-10 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 p-1 rounded-lg border border-slate-200 shadow-sm">
                <button onClick={() => setScale(s => Math.min(s + 0.2, 4))} className="p-1 hover:bg-slate-100 rounded" title="Zoom In"><ZoomIn className="w-4 h-4 text-slate-600"/></button>
                <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="p-1 hover:bg-slate-100 rounded" title="Zoom Out"><ZoomOut className="w-4 h-4 text-slate-600"/></button>
                <button onClick={resetView} className="p-1 hover:bg-slate-100 rounded" title="Reset"><Maximize className="w-4 h-4 text-slate-600"/></button>
            </div>

            <div 
                className="bg-white p-2 rounded-lg border border-slate-100 shadow-inner overflow-hidden w-full flex justify-center cursor-move relative"
                style={{ height: '520px' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                 <div className="absolute top-2 left-2 text-[10px] text-slate-400 pointer-events-none flex items-center gap-1 z-10">
                    <Move className="w-3 h-3"/>
                </div>

                <svg width={viewerW} height={viewerH} viewBox={`0 0 ${viewerW} ${viewerH}`}>
                     <g transform={`translate(${position.x}, ${position.y}) scale(${scale})`} style={{ transformOrigin: 'center' }}>
                        {/* Concrete */}
                        <rect x={startX} y={startY} width={drawW} height={drawH} fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
                        
                        {/* Bars */}
                        {bars}
                        
                        {/* Stirrups */}
                        {stirrups}

                        {/* Dimensions */}
                        {/* Height */}
                        <g>
                            <line x1={startX - 15} y1={startY} x2={startX - 15} y2={endY} stroke="#64748b" strokeWidth="1" />
                            <line x1={startX - 20} y1={startY} x2={startX - 10} y2={startY} stroke="#64748b" strokeWidth="1" />
                            <line x1={startX - 20} y1={endY} x2={startX - 10} y2={endY} stroke="#64748b" strokeWidth="1" />
                            <text x={startX - 25} y={(startY+endY)/2} textAnchor="middle" transform={`rotate(-90 ${startX-25} ${(startY+endY)/2})`} fontSize="11" fill="#64748b">H = {height} m</text>
                        </g>

                        {/* Labels */}
                        <g transform={`translate(${startX + drawW + 10}, ${startY + 40})`}>
                            <line x1={0} y1={0} x2={20} y2={0} stroke="#ef4444" strokeWidth="1" />
                            <circle cx={0} cy={0} r={2} fill="#ef4444" />
                            <Label x={25} y={4} text={`Estribos ø${stirrupDiameter} c/${stirrupSpacing}`} />
                        </g>

                        <g transform={`translate(${startX + drawW + 10}, ${endY - 40})`}>
                            <line x1={0} y1={0} x2={20} y2={0} stroke="#1e293b" strokeWidth="1" />
                            <circle cx={0} cy={0} r={2} fill="#1e293b" />
                            <Label x={25} y={4} text={`${numBarsX * 2 + (details.leftLayers?.[0]||0)*2} barras ø${bottomBarDiameter}`} />
                        </g>

                     </g>
                </svg>
            </div>
            <div className="mt-2 text-xs text-slate-500 text-center">
                 <p className="font-semibold text-slate-700">Vista Lateral (Elevação)</p>
                 <p>Esquema de distribuição vertical</p>
            </div>
        </div>
    );
};

export default ColumnLongitudinalViewer;