import React from 'react';
import { CrossSectionDetails } from '../types';

interface Beam3DViewerProps {
    details: CrossSectionDetails;
}

const Beam3DViewer: React.FC<Beam3DViewerProps> = ({ details }) => {
    const { 
        width, height, cover, stirrupDiameter, stirrupSpacing,
        stirrupHookAngle, bottomBarDiameter, topBarDiameter, 
        bottomLayers, topLayers, stirrupLegs
    } = details;

    // Scales
    const scale = 2; // Pixels per cm
    const beamLenCm = 100; // Visual length of beam slice in cm
    
    // Coordinates
    const w = width * scale;
    const h = height * scale;
    const l = beamLenCm * scale;
    
    // Helper to project 3D (x, y, z) to 2D (screenX, screenY)
    const project = (x: number, y: number, z: number) => {
        // Cabinet-ish projection
        const depthFactor = 0.6;
        const angle = -Math.PI/6;
        return {
            x: x + z * depthFactor * Math.cos(angle) + 50,
            y: y + z * depthFactor * Math.sin(angle) + 100
        };
    };

    // --- Geometries ---

    // 1. Concrete Block Corners
    const corners = [
        project(0, 0, 0),       // 0: Front Top Left
        project(w, 0, 0),       // 1: Front Top Right
        project(w, h, 0),       // 2: Front Bottom Right
        project(0, h, 0),       // 3: Front Bottom Left
        project(0, 0, l),       // 4: Back Top Left
        project(w, 0, l),       // 5: Back Top Right
        project(w, h, l),       // 6: Back Bottom Right
        project(0, h, l),       // 7: Back Bottom Left
    ];

    // 2. Stirrups
    const stirrupOffset = cover * scale;
    const sw = w - 2 * stirrupOffset;
    const sh = h - 2 * stirrupOffset;
    const numStirrups = Math.floor(beamLenCm / stirrupSpacing);
    const stirrups = [];

    // Hook calculations
    const hookLen = Math.max(5 * scale, 30); // Min visual length
    
    for (let i = 0; i < numStirrups; i++) {
        const z = (i * stirrupSpacing * scale) + stirrupOffset;
        const sP = { x: stirrupOffset, y: stirrupOffset }; // Local Top-Left

        const p0 = project(sP.x, sP.y, z); // Top Left
        const p1 = project(sP.x + sw, sP.y, z); // Top Right
        const p2 = project(sP.x + sw, sP.y + sh, z); // Bottom Right
        const p3 = project(sP.x, sP.y + sh, z); // Bottom Left

        // Main Loop
        let d = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p0.x} ${p0.y}`;

        // Hooks Logic
        // We will assume the hooks are at the Top-Left corner (p0) for standard visualization.
        // A 135 deg hook bends INWARDS into the concrete core (diagonally).
        // A 90 deg hook extends straight along the side (downwards or inwards).
        
        if (stirrupHookAngle === 135) {
             // 135 deg: Bends inward diagonally towards center of beam
             // This corresponds to 45 deg relative to the horizontal/vertical axis inside the cage
             
             // First hook (coming from top side, bending down-right into core)
             const h1x = sP.x + hookLen * 0.707;
             const h1y = sP.y + hookLen * 0.707;
             const h1End = project(h1x, h1y, z);
             
             // Second hook (coming from left side, bending right-down into core)
             // Actually standard seismic hook wraps around the bar. 
             // Visual simplification: Two prongs pointing inwards at the corner.
             const offset = 4; // slight offset so lines don't perfectly overlap
             const h2x = sP.x + hookLen * 0.707 + offset; 
             const h2y = sP.y + hookLen * 0.707 - offset;
             const h2End = project(h2x, h2y, z);

             d += ` M ${p0.x} ${p0.y} L ${h1End.x} ${h1End.y}`;
             d += ` M ${p0.x} ${p0.y} L ${h2End.x} ${h2End.y}`;

        } else {
             // 90 deg: Standard rectangular extension
             // One extension goes down, one goes right
             const h1End = project(sP.x, sP.y + hookLen, z);
             const h2End = project(sP.x + hookLen, sP.y, z);
             
             // Draw hooks
             d += ` M ${p0.x} ${p0.y} L ${h1End.x} ${h1End.y}`;
             d += ` M ${p0.x} ${p0.y} L ${h2End.x} ${h2End.y}`;
        }

        // Internal Legs (if stirrupLegs > 2)
        if (stirrupLegs > 2) {
            const extraLegs = stirrupLegs - 2;
            const legSpacing = sw / (extraLegs + 1);
            for(let k=1; k<=extraLegs; k++) {
                const lx = sP.x + k * legSpacing;
                const lTop = project(lx, sP.y, z);
                const lBot = project(lx, sP.y + sh, z);
                d += ` M ${lTop.x} ${lTop.y} L ${lBot.x} ${lBot.y}`;
                // Simple hook for tie at top
                if (stirrupHookAngle === 135) {
                     // 135 hook on internal tie
                     const lhEnd = project(lx + hookLen*0.7, sP.y + hookLen*0.7, z);
                     d += ` M ${lTop.x} ${lTop.y} L ${lhEnd.x} ${lhEnd.y}`;
                     // And bottom hook usually alternates, but keeping simple
                     const lbEnd = project(lx - hookLen*0.7, sP.y + sh - hookLen*0.7, z);
                     d += ` M ${lBot.x} ${lBot.y} L ${lbEnd.x} ${lbEnd.y}`;
                } else {
                     const lHook = project(lx + hookLen, sP.y, z);
                     d += ` M ${lTop.x} ${lTop.y} L ${lHook.x} ${lHook.y}`;
                }
            }
        }

        stirrups.push(<path key={`s-${i}`} d={d} stroke="#ef4444" strokeWidth="2" fill="none" opacity="0.9"/>);
    }

    // 3. Longitudinal Bars
    const bars: React.ReactNode[] = [];
    const stirrupUnit = (stirrupDiameter / 10) * scale;
    const usefulWidth = w - 2 * stirrupOffset - 2 * stirrupUnit;
    const startX = stirrupOffset + stirrupUnit;
    
    const generateBars = (layers: number[], isTop: boolean) => {
        const barDia = isTop ? topBarDiameter : bottomBarDiameter;
        const barRad = (barDia / 10 / 2) * scale;
        const barDiaScaled = barRad * 2;
        
        layers.forEach((count, layerIdx) => {
             let yPos = 0;
             const layerSpacing = Math.max(20, barDiaScaled);
             
             if (isTop) {
                 const baseTop = stirrupOffset + stirrupUnit + barRad;
                 yPos = baseTop + (layerIdx * (layerSpacing + barDiaScaled));
             } else {
                 const baseBottom = h - stirrupOffset - stirrupUnit - barRad;
                 yPos = baseBottom - (layerIdx * (layerSpacing + barDiaScaled));
             }

             if (count === 1) {
                 const cx = startX + usefulWidth / 2;
                 const start = project(cx, yPos, -10);
                 const end = project(cx, yPos, l + 10);
                 bars.push(<line key={`${isTop?'t':'b'}-${layerIdx}-0`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={isTop ? "#475569" : "#1e293b"} strokeWidth={barRad*2} strokeLinecap="round"/>);
             } else {
                 const centerStart = startX + barRad;
                 const centerEnd = startX + usefulWidth - barRad;
                 const step = (centerEnd - centerStart) / (count - 1);

                 for(let i=0; i<count; i++) {
                     const cx = centerStart + (i * step);
                     const start = project(cx, yPos, -10);
                     const end = project(cx, yPos, l + 10);
                     bars.push(<line key={`${isTop?'t':'b'}-${layerIdx}-${i}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={isTop ? "#475569" : "#1e293b"} strokeWidth={barRad*2} strokeLinecap="round"/>);
                 }
             }
        });
    };

    generateBars(bottomLayers, false);
    generateBars(topLayers, true);

    return (
        <div className="flex flex-col items-center">
             <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-inner overflow-hidden">
                <svg width="400" height="300" viewBox="-50 0 500 400">
                    <defs>
                        <linearGradient id="concreteGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f1f5f9" stopOpacity="0.8"/>
                            <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.8"/>
                        </linearGradient>
                    </defs>

                    {/* Back Faces */}
                    <path d={`M ${corners[4].x} ${corners[4].y} L ${corners[5].x} ${corners[5].y} L ${corners[6].x} ${corners[6].y} L ${corners[7].x} ${corners[7].y} Z`} fill="#e2e8f0" stroke="none" />
                    
                    {/* Bars behind concrete logic is hard in simple SVG, drawing bars first */}
                    {bars}
                    {stirrups}

                    {/* Front Face (Transparent) */}
                    <path d={`M ${corners[0].x} ${corners[0].y} L ${corners[1].x} ${corners[1].y} L ${corners[2].x} ${corners[2].y} L ${corners[3].x} ${corners[3].y} Z`} fill="url(#concreteGrad)" stroke="#94a3b8" strokeWidth="1" opacity="0.3" />
                    
                    {/* Edges */}
                    <line x1={corners[0].x} y1={corners[0].y} x2={corners[4].x} y2={corners[4].y} stroke="#94a3b8" strokeWidth="1" opacity="0.5"/>
                    <line x1={corners[1].x} y1={corners[1].y} x2={corners[5].x} y2={corners[5].y} stroke="#94a3b8" strokeWidth="1" opacity="0.5"/>
                    <line x1={corners[2].x} y1={corners[2].y} x2={corners[6].x} y2={corners[6].y} stroke="#94a3b8" strokeWidth="1" opacity="0.5"/>
                    <line x1={corners[3].x} y1={corners[3].y} x2={corners[7].x} y2={corners[7].y} stroke="#94a3b8" strokeWidth="1" opacity="0.5"/>
                </svg>
             </div>
             <div className="mt-2 text-xs text-slate-500 text-center">
                 <p className="font-semibold text-slate-700">Visualização Isométrica</p>
                 <p className="font-mono text-[10px]">Estribos {stirrupLegs} ramos ø{stirrupDiameter}mm c/ {stirrupSpacing}cm (Gancho {stirrupHookAngle}º)</p>
             </div>
        </div>
    );
};

export default Beam3DViewer;
