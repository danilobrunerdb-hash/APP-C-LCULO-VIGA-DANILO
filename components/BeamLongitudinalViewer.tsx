import React, { useState } from 'react';
import { CrossSectionDetails } from '../types';
import { ZoomIn, ZoomOut, Maximize, Move } from 'lucide-react';

interface BeamLongitudinalViewerProps {
    details: CrossSectionDetails;
    span: number; // in meters
}

const BeamLongitudinalViewer: React.FC<BeamLongitudinalViewerProps> = ({ details, span }) => {
    const { 
        height, cover, stirrupDiameter, stirrupSpacing,
        bottomBarDiameter, topBarDiameter, 
        bottomLayers, topLayers 
    } = details;

    // Zoom State
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

    // View Configuration
    const widthPx = 700;
    const heightPx = 300;
    const paddingX = 60;
    const paddingY = 60;
    
    // Scales
    const spanCm = span * 100;
    const scaleX = (widthPx - 2 * paddingX) / spanCm;
    const visualBeamHeight = 120;
    const scaleY = visualBeamHeight / height;

    const beamTopY = paddingY + (heightPx - 2*paddingY - visualBeamHeight)/2;
    const beamBottomY = beamTopY + visualBeamHeight;

     // Interaction Handlers
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

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const resetView = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    // --- Drawing ---

    // 1. Concrete Outline
    // Start X
    const xStart = paddingX;
    const xEnd = widthPx - paddingX;

    // 2. Stirrups
    const stirrupOffsetCm = 5; // Start distribution 5cm from face usually
    const numStirrups = Math.floor((spanCm - 2 * stirrupOffsetCm) / stirrupSpacing) + 1;
    const stirrups = [];
    
    for(let i = 0; i < numStirrups; i++) {
        const xCm = stirrupOffsetCm + i * stirrupSpacing;
        const x = xStart + xCm * scaleX;
        
        // Visual vertical line
        const y1 = beamTopY + (cover * scaleY);
        const y2 = beamBottomY - (cover * scaleY);
        
        stirrups.push(
            <line key={`s-${i}`} x1={x} y1={y1} x2={x} y2={y2} stroke="#ef4444" strokeWidth="1" />
        );
    }

    // 3. Longitudinal Bars (Iterate Layers)
    const drawLongitudinalBars = (isTop: boolean, layers: number[]) => {
        const barDia = isTop ? topBarDiameter : bottomBarDiameter;
        const barsSVG = [];
        
        // Spacing between layers
        const layerSpacingCm = Math.max(2.0, barDia/10);
        const startY = isTop 
            ? beamTopY + (cover * scaleY) + ((stirrupDiameter/10) * scaleY) + ((barDia/10/2) * scaleY)
            : beamBottomY - (cover * scaleY) - ((stirrupDiameter/10) * scaleY) - ((barDia/10/2) * scaleY);
            
        for(let i=0; i<layers.length; i++) {
            const count = layers[i];
            if(count === 0) continue;
            
            let y = startY;
            if(isTop) {
                y += i * (layerSpacingCm * scaleY + (barDia/10 * scaleY));
            } else {
                y -= i * (layerSpacingCm * scaleY + (barDia/10 * scaleY));
            }
            
            barsSVG.push(
                <line 
                    key={`${isTop?'t':'b'}-${i}`}
                    x1={xStart} y1={y} x2={xEnd} y2={y} 
                    stroke={isTop ? "#475569" : "#1e293b"} 
                    strokeWidth={Math.max(2, (barDia/10)*scaleY)} 
                    strokeLinecap="round"
                />
            );
        }
        return barsSVG;
    };

    const topBars = drawLongitudinalBars(true, topLayers);
    const botBars = drawLongitudinalBars(false, bottomLayers);

    // --- Annotations (Callouts) ---
    
    const Callout = ({ x, y, text, direction }: { x: number, y: number, text: string, direction: 'up' | 'down' | 'left' }) => {
        const lineLen = 30;
        let x2 = x, y2 = y;
        let baseline = "middle";

        if (direction === 'up') {
            y2 = y - lineLen;
            baseline = "bottom";
        } else if (direction === 'down') {
            y2 = y + lineLen;
            baseline = "hanging";
        }

        return (
            <g>
                <circle cx={x} cy={y} r={2} fill="#64748b" />
                <line x1={x} y1={y} x2={x2} y2={y2} stroke="#64748b" strokeWidth="1" />
                <text x={x2} y={direction === 'up' ? y2 - 5 : y2 + 5} textAnchor="middle" fontSize="11" fill="#1e293b" fontWeight="600" dominantBaseline={baseline === 'hanging' ? 'hanging' : 'auto'}>{text}</text>
            </g>
        );
    };

    // Construct Labels for Layers
    const getLayerLabel = (layers: number[], dia: number) => {
        const parts = [];
        for(let i=0; i<layers.length; i++) {
            if(layers[i] > 0) {
                parts.push(`${layers[i]}ø${dia}`);
            }
        }
        return parts.join(' + ');
    };

    const topLabel = getLayerLabel(topLayers, topBarDiameter);
    const botLabel = getLayerLabel(bottomLayers, bottomBarDiameter);
    const totalStirrups = numStirrups;

    // Stirrup Label (N1)
    const labelX1 = xStart + (scaleX * spanCm * 0.2);
    const labelX2 = xStart + (scaleX * spanCm * 0.4);
    const labelY = (beamTopY + beamBottomY) / 2;
    const stirrupLabel = (
        <g>
            <line x1={labelX1} y1={labelY} x2={labelX2} y2={labelY} stroke="#ef4444" strokeWidth="1" />
            <circle cx={labelX1} cy={labelY} r={1.5} fill="#ef4444"/>
            <circle cx={labelX2} cy={labelY} r={1.5} fill="#ef4444"/>
            <text x={(labelX1+labelX2)/2} y={labelY - 5} textAnchor="middle" fontSize="11" fill="#ef4444" fontWeight="bold">
                {totalStirrups} estribos ø{stirrupDiameter} c/{stirrupSpacing}
            </text>
        </g>
    );
    
    // Coordinates for labels (approximate top/bottom layer Y)
    const lblTopY = beamTopY + (cover * scaleY);
    const lblBotY = beamBottomY - (cover * scaleY);

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
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                <div className="absolute top-2 left-2 text-[10px] text-slate-400 pointer-events-none flex items-center gap-1 z-10">
                    <Move className="w-3 h-3"/>
                </div>

                <svg width={widthPx} height={heightPx} viewBox={`0 0 ${widthPx} ${heightPx}`} className="max-w-full">
                    
                    <g transform={`translate(${position.x}, ${position.y}) scale(${scale})`} style={{ transformOrigin: 'center' }}>
                        {/* Beam Body Outline */}
                        <rect x={xStart} y={beamTopY} width={widthPx - 2*paddingX} height={visualBeamHeight} fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
                        
                        {/* Stirrups */}
                        {stirrups}
                        
                        {/* Bars */}
                        {topBars}
                        {botBars}

                        {/* Annotations */}
                        <Callout 
                            x={xStart + (widthPx - 2*paddingX)/2} 
                            y={lblTopY} 
                            direction="up" 
                            text={topLabel} 
                        />
                        
                        <Callout 
                            x={xStart + (widthPx - 2*paddingX)/2} 
                            y={lblBotY} 
                            direction="down" 
                            text={botLabel} 
                        />

                        {stirrupLabel}

                        {/* Span Dimension */}
                        <g transform={`translate(0, ${beamBottomY + 40})`}>
                            <line x1={xStart} y1={0} x2={xEnd} y2={0} stroke="#64748b" strokeWidth="1" />
                            <line x1={xStart} y1={-5} x2={xStart} y2={5} stroke="#64748b" strokeWidth="1" />
                            <line x1={xEnd} y1={-5} x2={xEnd} y2={5} stroke="#64748b" strokeWidth="1" />
                            <text x={widthPx/2} y={15} textAnchor="middle" fontSize="12" fill="#64748b">Vão = {spanCm.toFixed(0)} cm</text>
                        </g>

                        {/* Height Dimension */}
                        <g transform={`translate(${xStart - 20}, 0)`}>
                            <line x1={0} y1={beamTopY} x2={0} y2={beamBottomY} stroke="#64748b" strokeWidth="1" />
                            <line x1={-5} y1={beamTopY} x2={5} y2={beamTopY} stroke="#64748b" strokeWidth="1" />
                            <line x1={-5} y1={beamBottomY} x2={5} y2={beamBottomY} stroke="#64748b" strokeWidth="1" />
                            <text x={-10} y={(beamTopY+beamBottomY)/2} textAnchor="end" fontSize="12" fill="#64748b" dominantBaseline="middle">h={height}cm</text>
                        </g>
                    </g>

                </svg>
            </div>
            <div className="mt-2 text-xs text-slate-500 text-center">
                 <p className="font-semibold text-slate-700">Vista Lateral (Elevação)</p>
                 <p>Detalhamento esquemático longitudinal com camadas</p>
            </div>
        </div>
    );
};

export default BeamLongitudinalViewer;