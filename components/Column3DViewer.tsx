import React from 'react';
import { CrossSectionDetails } from '../types';

interface Column3DViewerProps {
    details: CrossSectionDetails;
}

const Column3DViewer: React.FC<Column3DViewerProps> = ({ details }) => {
    const { 
        width, height, cover, stirrupDiameter, stirrupSpacing,
        stirrupHookAngle, bottomBarDiameter, topBarDiameter, 
        bottomLayers, topLayers, leftLayers, rightLayers, stirrupLegs
    } = details;

    // Scales
    const scale = 2.5; // Pixels per cm
    const colHeightCm = 100; // Visual height of column slice in cm (representative)
    
    // Dimensions scaled
    const w = width * scale;  // Width (X)
    const d = height * scale; // Depth (Z) - dimension perpendicular to view in 2D section, but here Z
    const h = colHeightCm * scale; // Height (Y) - Vertical dimension

    // Projection Constants
    // Origin is at bottom-center of drawing area
    const originX = 150;
    const originY = 350;

    // Project 3D (x, y, z) to 2D screen coordinates
    // x: Width axis (Right)
    // y: Height axis (Up) -> Screen Y decreases
    // z: Depth axis (Back/Right diagonal)
    const project = (x: number, y: number, z: number) => {
        const angle = -Math.PI / 6; // 30 degrees
        const depthScale = 0.7;
        
        return {
            x: originX + x + (z * depthScale * Math.cos(angle)),
            y: originY - y + (z * depthScale * Math.sin(angle))
        };
    };

    // --- Geometries ---

    // 1. Concrete Block Corners (Prism)
    // Base is at y=0, Top is at y=h
    // Section is w (x) by d (z)
    
    // Base coordinates
    const b0 = project(0, 0, 0); // Front-Left Base
    const b1 = project(w, 0, 0); // Front-Right Base
    const b2 = project(w, 0, d); // Back-Right Base
    const b3 = project(0, 0, d); // Back-Left Base
    
    // Top coordinates
    const t0 = project(0, h, 0); // Front-Left Top
    const t1 = project(w, h, 0); // Front-Right Top
    const t2 = project(w, h, d); // Back-Right Top
    const t3 = project(0, h, d); // Back-Left Top

    // 2. Stirrups
    const stirrupOffset = cover * scale;
    const sw = w - 2 * stirrupOffset;
    const sd = d - 2 * stirrupOffset;
    
    const numStirrups = Math.floor(colHeightCm / stirrupSpacing);
    const stirrups = [];
    const hookLen = Math.max(5 * scale, 15);

    for (let i = 0; i <= numStirrups; i++) {
        const y = i * stirrupSpacing * scale;
        if (y > h - stirrupOffset) break;
        
        // Stirrup local coords relative to concrete origin
        // x starts at stirrupOffset, z starts at stirrupOffset
        const sx = stirrupOffset;
        const sz = stirrupOffset;
        
        // Project 4 corners of stirrup at height y
        const p0 = project(sx, y, sz);           // Front-Left
        const p1 = project(sx + sw, y, sz);      // Front-Right
        const p2 = project(sx + sw, y, sz + sd); // Back-Right
        const p3 = project(sx, y, sz + sd);      // Back-Left
        
        let path = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p0.x} ${p0.y}`;

        // Hooks (at Front-Left Corner p0 for simplicity)
        if (stirrupHookAngle === 135) {
            // Diagonal inwards into core
            const h1 = project(sx + hookLen * 0.7, y, sz + hookLen * 0.7);
            const h2 = project(sx + hookLen * 0.7, y - hookLen * 0.5, sz + hookLen * 0.5); // Slightly varied
            path += ` M ${p0.x} ${p0.y} L ${h1.x} ${h1.y}`;
            path += ` M ${p0.x} ${p0.y} L ${h2.x} ${h2.y}`;
        } else {
             // 90 deg: Extension along axes
             const h1 = project(sx + hookLen, y, sz);
             const h2 = project(sx, y, sz + hookLen);
             path += ` M ${p0.x} ${p0.y} L ${h1.x} ${h1.y}`;
             path += ` M ${p0.x} ${p0.y} L ${h2.x} ${h2.y}`;
        }

        stirrups.push(<path key={`s-${i}`} d={path} stroke="#ef4444" strokeWidth="2" fill="none" opacity="0.9"/>);
    }

    // 3. Longitudinal Bars
    const bars: React.ReactNode[] = [];
    const stirrupDiaScale = (stirrupDiameter / 10) * scale;
    // Useful area for bars starts inside stirrup
    const startX = stirrupOffset + stirrupDiaScale;
    const startZ = stirrupOffset + stirrupDiaScale;
    const usefulW = w - 2 * (stirrupOffset + stirrupDiaScale);
    const usefulD = d - 2 * (stirrupOffset + stirrupDiaScale);

    const drawBar = (bx: number, bz: number, dia: number, key: string) => {
        const radius = (dia / 10 / 2) * scale;
        // Adjust center
        const cx = bx + radius;
        const cz = bz + radius;
        
        const bStart = project(cx, -10, cz); // Slightly below
        const bEnd = project(cx, h + 10, cz); // Slightly above
        
        bars.push(
            <line 
                key={key} 
                x1={bStart.x} y1={bStart.y} 
                x2={bEnd.x} y2={bEnd.y} 
                stroke="#1e293b" 
                strokeWidth={radius * 2} 
                strokeLinecap="round" 
            />
        );
    };

    // Distribute bars
    // Top/Bottom Layers refer to X-distribution at Z-limits (Front/Back faces in section, but in 3D prism orientation)
    // Wait, in CrossSection.tsx:
    // width corresponds to SVG width. height corresponds to SVG height.
    // Here we mapped width -> X, height -> Z.
    // "Bottom" in section means max Y in SVG (or min Y in math).
    // Let's assume:
    // Bottom Layers -> Front Face (Z=0) ? No, standard section 'bottom' is typically y=0 in math or y=H in svg.
    // Let's map: 
    // "Bottom" layers -> Z = 0 (Front face)
    // "Top" layers -> Z = d (Back face)
    // "Left" layers -> X = 0 (Left face)
    // "Right" layers -> X = w (Right face)
    
    // Bottom (Front Z=0)
    // Usually one layer for columns
    bottomLayers.forEach((count, idx) => {
        if(count === 0) return;
        // In section 'bottom' is y=H. In our 3D Z=0.
        // Let's stick to standard Beam/Column mapping. 
        // If bottom is Z=0.
        const zPos = startZ; 
        const spacing = count > 1 ? usefulW / (count - 1) : 0;
        const offset = count === 1 ? usefulW/2 : 0;
        
        for(let i=0; i<count; i++) {
             drawBar(startX + offset + i*spacing, zPos, bottomBarDiameter, `bot-${idx}-${i}`);
        }
    });

    // Top (Back Z=d)
    topLayers.forEach((count, idx) => {
        if(count === 0) return;
        const zPos = startZ + usefulD;
        const spacing = count > 1 ? usefulW / (count - 1) : 0;
        const offset = count === 1 ? usefulW/2 : 0;
        
        for(let i=0; i<count; i++) {
             drawBar(startX + offset + i*spacing, zPos, topBarDiameter, `top-${idx}-${i}`);
        }
    });

    // Side bars (Left X=0 and Right X=w)
    // These are distributed along Z (Depth), strictly between top and bottom rows
    // We need to calculate step based on Z
    if (leftLayers && leftLayers[0] > 0) {
        const count = leftLayers[0];
        // Distribute between front and back rows
        // Available depth for intermediate bars
        // The corner bars are already drawn by Top/Bottom loops (indices 0 and last)
        // Usually 'leftLayers' count excludes corners in my calculation logic in utils?
        // Let's check calculations.ts: "sideBarsVert = nVertTotal / 2; // Bars on Left... excluding corners"
        // Yes, these are intermediate bars.
        
        const zStep = usefulD / (count + 1);
        for(let i=1; i<=count; i++) {
            drawBar(startX, startZ + i*zStep, bottomBarDiameter, `left-${i}`);
        }
    }

    if (rightLayers && rightLayers[0] > 0) {
        const count = rightLayers[0];
        const zStep = usefulD / (count + 1);
        for(let i=1; i<=count; i++) {
            drawBar(startX + usefulW, startZ + i*zStep, bottomBarDiameter, `right-${i}`);
        }
    }

    return (
        <div className="flex flex-col items-center">
             <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-inner overflow-hidden">
                <svg width="400" height="400" viewBox="0 0 400 400">
                    <defs>
                        <linearGradient id="colConcGrad" x1="0" y1="1" x2="1" y2="0">
                            <stop offset="0%" stopColor="#f1f5f9" stopOpacity="0.9"/>
                            <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.9"/>
                        </linearGradient>
                    </defs>

                    {/* Back Faces (Inside) - Draw First */}
                    <path d={`M ${b3.x} ${b3.y} L ${b2.x} ${b2.y} L ${t2.x} ${t2.y} L ${t3.x} ${t3.y} Z`} fill="#e2e8f0" stroke="none" />
                    <path d={`M ${b3.x} ${b3.y} L ${b0.x} ${b0.y} L ${t0.x} ${t0.y} L ${t3.x} ${t3.y} Z`} fill="#cbd5e1" stroke="none" opacity="0.5"/>

                    {/* Rebar Cage */}
                    {bars}
                    {stirrups}

                    {/* Front Faces (Transparent) */}
                    {/* Front Face (Z=0) */}
                    <path d={`M ${b0.x} ${b0.y} L ${b1.x} ${b1.y} L ${t1.x} ${t1.y} L ${t0.x} ${t0.y} Z`} fill="url(#colConcGrad)" stroke="#94a3b8" strokeWidth="1" opacity="0.4" />
                    {/* Side Face (X=w) */}
                    <path d={`M ${b1.x} ${b1.y} L ${b2.x} ${b2.y} L ${t2.x} ${t2.y} L ${t1.x} ${t1.y} Z`} fill="#94a3b8" stroke="#94a3b8" strokeWidth="1" opacity="0.2" />
                    
                    {/* Top Cap */}
                    <path d={`M ${t0.x} ${t0.y} L ${t1.x} ${t1.y} L ${t2.x} ${t2.y} L ${t3.x} ${t3.y} Z`} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" opacity="0.6"/>

                    {/* Dimensions / Axes hint */}
                    <line x1={b0.x - 10} y1={b0.y} x2={b0.x - 10} y2={t0.y} stroke="#64748b" strokeWidth="1" markerEnd="url(#arrow)" />
                    <text x={b0.x - 20} y={(b0.y+t0.y)/2} textAnchor="middle" transform={`rotate(-90 ${b0.x - 20} ${(b0.y+t0.y)/2})`} fontSize="10" fill="#64748b">h (Vertical)</text>

                </svg>
             </div>
             <div className="mt-2 text-xs text-slate-500 text-center">
                 <p className="font-semibold text-slate-700">Perspectiva do Pilar</p>
                 <p className="font-mono text-[10px]">Slice representativo de 1m</p>
             </div>
        </div>
    );
};

export default Column3DViewer;