import React, { useState, useRef } from 'react';
import { CrossSectionDetails } from '../types';
import { ZoomIn, ZoomOut, Maximize, Move } from 'lucide-react';

interface CrossSectionProps {
  details: CrossSectionDetails;
  isFullScreen?: boolean;
}

const CrossSection: React.FC<CrossSectionProps> = ({ details, isFullScreen = false }) => {
  const { 
    width, height, cover, stirrupDiameter, stirrupLegs, stirrupHookAngle,
    bottomBarDiameter, topBarDiameter, bottomLayers, topLayers, leftLayers, rightLayers
  } = details;

  // Zoom State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Scale: Mapping real cm to SVG units. Let's say 1 cm = 10 SVG units.
  const svgUnitScale = 10;
  const svgWidth = width * svgUnitScale;
  const svgHeight = height * svgUnitScale;
  
  // Padding for visualization
  const padding = 50; 
  const totalSvgWidth = svgWidth + padding * 2;
  const totalSvgHeight = svgHeight + padding * 2;

  // Dimensions in SVG units
  const coverUnit = cover * svgUnitScale;
  const stirrupUnit = (stirrupDiameter / 10) * svgUnitScale;
  
  const bottomBarUnit = (bottomBarDiameter / 10) * svgUnitScale;
  const bottomBarRadius = bottomBarUnit / 2;
  
  const topBarUnit = (topBarDiameter / 10) * svgUnitScale;
  const topBarRadius = topBarUnit / 2;

  // Stirrup Path (Outer boundary of stirrup)
  const stirrupLeft = padding + coverUnit;
  const stirrupTop = padding + coverUnit;
  const stirrupW = svgWidth - (2 * coverUnit);
  const stirrupH = svgHeight - (2 * coverUnit);
  
  // Real dimensions for labels
  const stirrupDimW = width - 2 * cover;
  const stirrupDimH = height - 2 * cover;
  
  // Hook Calculation NBR 6118
  // 90 deg: ~8phi or 7cm min
  // 135 deg: ~5phi or 5cm min
  const stirrupDiaCm = stirrupDiameter / 10;
  let hookLen = 0;
  if (stirrupHookAngle === 135) {
      hookLen = Math.max(5 * stirrupDiaCm, 5.0);
  } else {
      hookLen = Math.max(8 * stirrupDiaCm, 7.0); 
  }

  const usefulWidthCm = width - 2 * cover - 2 * (stirrupDiameter/10);

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

  // Helper for architectural dimension ticks
  const renderTick = (x: number, y: number, angle: number = -45) => {
      const length = 6;
      const rad = angle * Math.PI / 180;
      const dx = Math.cos(rad) * length;
      const dy = Math.sin(rad) * length;
      return <line x1={x-dx} y1={y-dy} x2={x+dx} y2={y+dy} stroke="#64748b" strokeWidth="1.5" />;
  };

  const renderLayer = (count: number, layerIndex: number, isTop: boolean) => {
    const bars = [];
    const barRadius = isTop ? topBarRadius : bottomBarRadius;
    const barUnit = isTop ? topBarUnit : bottomBarUnit;
    
    // Bounds inside stirrup
    const startX = stirrupLeft + stirrupUnit + barRadius; 
    const endX = stirrupLeft + stirrupW - stirrupUnit - barRadius; 
    
    // Y Position Calculation
    let yPos = 0;
    const layerSpacing = Math.max(20, barUnit); 
    const barDiaCm = isTop ? topBarDiameter / 10 : bottomBarDiameter / 10;
    
    // Calculate Spacing value for display
    let spacingVal = 0;
    if (count > 1) {
        spacingVal = (usefulWidthCm - (count * barDiaCm)) / (count - 1);
    }
    const spacingUnit = spacingVal * svgUnitScale;

    if (isTop) {
        // From top downwards
        const baseTop = stirrupTop + stirrupUnit + barRadius;
        yPos = baseTop + (layerIndex * (layerSpacing + barUnit));
    } else {
        // From bottom upwards
        const baseBottom = stirrupTop + stirrupH - stirrupUnit - barRadius;
        yPos = baseBottom - (layerIndex * (layerSpacing + barUnit));
    }

    if (count === 1) {
       // Single bar centered
       bars.push(<circle key={`${isTop ? 't' : 'b'}-${layerIndex}-0`} cx={(startX+endX)/2} cy={yPos} r={barRadius} fill={isTop ? "#475569" : "#1e293b"} />);
    } else {
        // Distribute evenly
        const totalDist = endX - startX;
        const step = totalDist / (count - 1);
        
        for (let i = 0; i < count; i++) {
            const bx = startX + (i * step);
            bars.push(
                <circle 
                    key={`${isTop ? 't' : 'b'}-${layerIndex}-` + i} 
                    cx={bx} 
                    cy={yPos} 
                    r={barRadius} 
                    fill={isTop ? "#475569" : "#1e293b"} 
                />
            );
        }

        // Draw Spacing Dimension (Ah) if > 1 bar and first layer
        if (layerIndex === 0 && count > 1) {
             const dimY = isTop ? yPos + barRadius + 15 : yPos - barRadius - 15;
             // Draw between first and second bar
             const b1x = startX + barRadius; // Right edge of bar 1
             const b2x = startX + step - barRadius; // Left edge of bar 2
             
             bars.push(
                 <g key={`dim-h-${isTop?'t':'b'}`}>
                    <line x1={b1x} y1={dimY} x2={b2x} y2={dimY} stroke="#64748b" strokeWidth="0.5" />
                    <line x1={b1x} y1={dimY-3} x2={b1x} y2={dimY+3} stroke="#64748b" strokeWidth="0.5" />
                    <line x1={b2x} y1={dimY-3} x2={b2x} y2={dimY+3} stroke="#64748b" strokeWidth="0.5" />
                    <text x={(b1x+b2x)/2} y={dimY - 3} textAnchor="middle" fontSize="9" fill="#64748b">ah={spacingVal.toFixed(1)}</text>
                 </g>
             );
        }
    }
    return bars;
  };

  const renderSideLayer = (count: number, isLeft: boolean) => {
      const bars = [];
      const barRadius = topBarRadius; // Assuming column uses same bar everywhere for viz simplifiction
      
      if (count <= 0) return [];
      
      const xPos = isLeft 
          ? stirrupLeft + stirrupUnit + barRadius 
          : stirrupLeft + stirrupW - stirrupUnit - barRadius;
      
      // Calculate available height strictly between top and bottom corner bars
      // We assume corner bars are at stirrupTop + stirrupUnit + radius AND stirrupBottom - stirrupUnit - radius
      const cornerYTop = stirrupTop + stirrupUnit + barRadius;
      const cornerYBot = stirrupTop + stirrupH - stirrupUnit - barRadius;
      
      const startY = cornerYTop;
      const endY = cornerYBot;
      const totalH = endY - startY;
      
      // We want to distribute 'count' bars evenly between the corners.
      // So we divide the space into (count + 1) segments.
      const step = totalH / (count + 1);
      
      for(let i=1; i<=count; i++) {
          const cy = startY + i * step;
          bars.push(
              <circle 
                  key={`${isLeft ? 'l' : 'r'}-${i}`} 
                  cx={xPos} 
                  cy={cy} 
                  r={barRadius} 
                  fill="#1e293b" 
              />
          );
      }
      return bars;
  };
  
  // Calculate vertical spacing between layers (Av)
  const drawAv = () => {
     const dims = [];
     // For bottom bars
     if (bottomLayers.length > 1) {
         const barDiaCm = bottomBarDiameter / 10;
         const barUnit = bottomBarUnit;
         const layerSpacing = Math.max(20, barUnit);
         const layerSpacingCm = layerSpacing / svgUnitScale; // Back to cm
         
         const baseBottom = stirrupTop + stirrupH - stirrupUnit - bottomBarRadius;
         const stride = layerSpacing + barUnit;
         const avCm = layerSpacing / svgUnitScale;

         const xPos = stirrupLeft + stirrupW / 2;
         const yLayer0 = baseBottom - bottomBarRadius; // Top of layer 0
         const yLayer1 = baseBottom - stride + bottomBarRadius; // Bottom of layer 1
         
         dims.push(
             <g key="av-b">
                 <line x1={xPos} y1={yLayer1} x2={xPos} y2={yLayer0} stroke="#64748b" strokeWidth="0.5" />
                 <text x={xPos + 5} y={(yLayer0+yLayer1)/2} textAnchor="start" fontSize="9" fill="#64748b" alignmentBaseline="middle">av={avCm.toFixed(1)}</text>
             </g>
         );
     }
     return dims;
  };

  return (
    <div className={`flex flex-col items-center relative group ${isFullScreen ? 'w-full' : ''}`}>
        {/* Controls Overlay */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 p-1 rounded-lg border border-slate-200 shadow-sm">
            <button onClick={() => setScale(s => Math.min(s + 0.2, 4))} className="p-1 hover:bg-slate-100 rounded" title="Zoom In"><ZoomIn className="w-4 h-4 text-slate-600"/></button>
            <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="p-1 hover:bg-slate-100 rounded" title="Zoom Out"><ZoomOut className="w-4 h-4 text-slate-600"/></button>
            <button onClick={resetView} className="p-1 hover:bg-slate-100 rounded" title="Reset"><Maximize className="w-4 h-4 text-slate-600"/></button>
        </div>

        <div 
            id="cross-section-svg" 
            className={`bg-white p-2 rounded-lg cursor-move overflow-hidden relative ${isFullScreen ? 'w-full flex justify-center' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
        >
             <div className="absolute top-2 left-2 text-[10px] text-slate-400 pointer-events-none flex items-center gap-1 z-10">
                <Move className="w-3 h-3"/>
            </div>

            <svg 
                width="100%" 
                height="auto" 
                viewBox={`0 0 ${totalSvgWidth} ${totalSvgHeight}`} 
                className={`border border-slate-100 bg-white rounded-lg shadow-inner ${isFullScreen ? 'max-h-[85vh] w-auto' : 'max-h-80'}`}
                style={{ maxWidth: isFullScreen ? '100%' : '350px' }}
            >
                <g transform={`translate(${position.x}, ${position.y}) scale(${scale})`} style={{ transformOrigin: 'center' }}>
                    {/* Concrete Section */}
                    <rect 
                        x={padding} 
                        y={padding} 
                        width={svgWidth} 
                        height={svgHeight} 
                        fill="#f1f5f9" 
                        stroke="#94a3b8" 
                        strokeWidth="2" 
                    />

                    {/* Stirrup */}
                    <rect 
                        x={stirrupLeft} 
                        y={stirrupTop} 
                        width={stirrupW} 
                        height={stirrupH} 
                        rx={stirrupUnit * 2} // Bent radius
                        fill="none" 
                        stroke="#ef4444" 
                        strokeWidth={stirrupUnit} 
                    />

                    {/* Bars */}
                    {bottomLayers.map((count, idx) => <g key={`b-${idx}`}>{renderLayer(count, idx, false)}</g>)}
                    {topLayers.map((count, idx) => <g key={`t-${idx}`}>{renderLayer(count, idx, true)}</g>)}
                    
                    {/* Side Bars (For Columns) */}
                    {leftLayers && leftLayers.map((count, idx) => <g key={`l-${idx}`}>{renderSideLayer(count, true)}</g>)}
                    {rightLayers && rightLayers.map((count, idx) => <g key={`r-${idx}`}>{renderSideLayer(count, false)}</g>)}

                    {drawAv()}

                    {/* --- COTAS / DIMENSIONS --- */}
                    
                    {/* Cota Inferior (Largura Total) */}
                    <g>
                        <line x1={padding} y1={padding + svgHeight + 15} x2={padding + svgWidth} y2={padding + svgHeight + 15} stroke="#64748b" strokeWidth="1" />
                        <line x1={padding} y1={padding + svgHeight + 5} x2={padding} y2={padding + svgHeight + 20} stroke="#cbd5e1" strokeWidth="1" />
                        <line x1={padding + svgWidth} y1={padding + svgHeight + 5} x2={padding + svgWidth} y2={padding + svgHeight + 20} stroke="#cbd5e1" strokeWidth="1" />
                        {renderTick(padding, padding + svgHeight + 15)}
                        {renderTick(padding + svgWidth, padding + svgHeight + 15)}
                        <text x={padding + svgWidth/2} y={padding + svgHeight + 28} textAnchor="middle" fontSize="11" fill="#475569" fontWeight="500">{width} cm</text>
                    </g>

                    {/* Cota Lateral Esquerda (Altura Total) */}
                    <g>
                        <line x1={padding - 15} y1={padding} x2={padding - 15} y2={padding + svgHeight} stroke="#64748b" strokeWidth="1" />
                        <line x1={padding - 20} y1={padding} x2={padding - 5} y2={padding} stroke="#cbd5e1" strokeWidth="1" />
                        <line x1={padding - 20} y1={padding + svgHeight} x2={padding - 5} y2={padding + svgHeight} stroke="#cbd5e1" strokeWidth="1" />
                        {renderTick(padding - 15, padding)}
                        {renderTick(padding - 15, padding + svgHeight)}
                        <text x={padding - 25} y={padding + svgHeight/2} textAnchor="middle" transform={`rotate(-90 ${padding - 25} ${padding + svgHeight/2})`} fontSize="11" fill="#475569" fontWeight="500">{height} cm</text>
                    </g>

                    {/* Cota Dimensão Estribo Horizontal */}
                    <g>
                        <line x1={stirrupLeft} y1={padding + svgHeight - 15} x2={stirrupLeft + stirrupW} y2={padding + svgHeight - 15} stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3" />
                        <line x1={stirrupLeft} y1={padding + svgHeight - 18} x2={stirrupLeft} y2={padding + svgHeight - 12} stroke="#ef4444" strokeWidth="1" />
                        <line x1={stirrupLeft+stirrupW} y1={padding + svgHeight - 18} x2={stirrupLeft+stirrupW} y2={padding + svgHeight - 12} stroke="#ef4444" strokeWidth="1" />
                        <text x={padding + svgWidth/2} y={padding + svgHeight - 18} textAnchor="middle" fontSize="10" fill="#ef4444">{stirrupDimW.toFixed(1)}</text>
                    </g>

                    {/* Cota Dimensão Estribo Vertical */}
                    <g>
                        <line x1={stirrupLeft + stirrupW + 15} y1={stirrupTop} x2={stirrupLeft + stirrupW + 15} y2={stirrupTop + stirrupH} stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3" />
                        <line x1={stirrupLeft + stirrupW + 12} y1={stirrupTop} x2={stirrupLeft + stirrupW + 18} y2={stirrupTop} stroke="#ef4444" strokeWidth="1" />
                        <line x1={stirrupLeft + stirrupW + 12} y1={stirrupTop+stirrupH} x2={stirrupLeft + stirrupW + 18} y2={stirrupTop+stirrupH} stroke="#ef4444" strokeWidth="1" />
                        <text x={stirrupLeft + stirrupW + 25} y={padding + svgHeight/2} textAnchor="middle" transform={`rotate(90 ${stirrupLeft + stirrupW + 25} ${padding + svgHeight/2})`} fontSize="10" fill="#ef4444">{stirrupDimH.toFixed(1)}</text>
                    </g>

                    {/* Cota Cobrimento */}
                    <g>
                        <line x1={padding} y1={padding + 20} x2={stirrupLeft} y2={padding + 20} stroke="#64748b" strokeWidth="1" />
                        {renderTick(padding, padding + 20)}
                        {renderTick(stirrupLeft, padding + 20)}
                        <text x={padding + coverUnit/2} y={padding + 15} textAnchor="middle" fontSize="9" fill="#64748b">c={cover}</text>
                    </g>
                </g>
            </svg>
        </div>
        <div className="mt-3 text-xs text-slate-500 flex flex-wrap justify-center gap-4 text-center">
            <span className="flex items-center"><div className="w-3 h-3 bg-red-500 border border-red-600 mr-1"></div> Estribo: {stirrupDimW.toFixed(1)}x{stirrupDimH.toFixed(1)}cm</span>
            <span className="flex items-center bg-slate-100 px-2 py-0.5 rounded">Gancho ({stirrupHookAngle}º): {hookLen.toFixed(1)}cm</span>
        </div>
    </div>
  );
};

export default CrossSection;