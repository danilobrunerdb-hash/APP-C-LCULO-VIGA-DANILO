import React, { useState, useRef, useEffect } from 'react';
import { BeamInput, PointLoad, DistributedLoad, Support, SupportType } from '../types';
import { ArrowDown, Trash2, BoxSelect, Triangle, Move, ArrowRightFromLine, ArrowRightToLine, TrendingUp, TrendingDown, GripVertical, AlertTriangle } from 'lucide-react';

interface BeamEditorProps {
    beamInput: BeamInput;
    onChange: (newInput: BeamInput) => void;
}

const BeamEditor: React.FC<BeamEditorProps> = ({ beamInput, onChange }) => {
    const [selectedTool, setSelectedTool] = useState<'none' | 'pointLoad' | 'distLoad' | 'support'>('none');
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [draggingType, setDraggingType] = useState<'support' | 'pointLoad' | 'distLoad' | null>(null);
    const [dragOffset, setDragOffset] = useState<number>(0); // Store offset from element center/start
    
    const svgRef = useRef<SVGSVGElement>(null);

    const { span, pointLoads, distributedLoads, supports } = beamInput;

    // Scale Logic
    const paddingX = 40;
    const paddingY = 80;
    const width = 600; 
    const height = 300;
    const pxPerMeter = (width - 2 * paddingX) / span;

    const meterToPx = (m: number) => paddingX + m * pxPerMeter;
    const pxToMeter = (px: number) => Math.max(0, Math.min(span, (px - paddingX) / pxPerMeter));
    
    // Scale for load heights based on MAX load value (any point or dist load)
    const maxLoadValue = Math.max(
        ...pointLoads.map(p => p.magnitude), 
        ...distributedLoads.map(d => Math.max(d.startMagnitude, d.endMagnitude)), 
        10 
    );
    
    const getLoadHeight = (magnitude: number) => {
        const maxHeight = 60; 
        return (magnitude / maxLoadValue) * (maxHeight); // Purely proportional
    };

    // Dragging Logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (draggingId && svgRef.current) {
                const CTM = svgRef.current.getScreenCTM();
                if (!CTM) return;
                
                const mouseX = (e.clientX - CTM.e) / CTM.a;
                const newPosRaw = pxToMeter(mouseX - dragOffset);
                const snappedPos = Math.round(newPosRaw * 10) / 10;

                if (draggingType === 'support') {
                    onChange({ ...beamInput, supports: supports.map(s => s.id === draggingId ? { ...s, position: snappedPos } : s) });
                } else if (draggingType === 'pointLoad') {
                    onChange({ ...beamInput, pointLoads: pointLoads.map(p => p.id === draggingId ? { ...p, position: snappedPos } : p) });
                } else if (draggingType === 'distLoad') {
                    // For dist load, we drag the start, keeping length constant
                    const target = distributedLoads.find(d => d.id === draggingId);
                    if (target) {
                        const len = target.end - target.start;
                        let newStart = snappedPos;
                        let newEnd = newStart + len;
                        if (newEnd > span) {
                             newEnd = span;
                             newStart = span - len;
                        }
                        if (newStart < 0) newStart = 0;
                        
                        onChange({ ...beamInput, distributedLoads: distributedLoads.map(d => d.id === draggingId ? { ...d, start: newStart, end: newEnd } : d) });
                    }
                }
            }
        };

        const handleMouseUp = () => {
            setDraggingId(null);
            setDraggingType(null);
            setDragOffset(0);
        };

        if (draggingId) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingId, draggingType, dragOffset, supports, pointLoads, distributedLoads, beamInput, onChange, span]);


    const handleSvgClick = (e: React.MouseEvent) => {
        if (!svgRef.current || selectedTool === 'none' || draggingId) return;

        const CTM = svgRef.current.getScreenCTM();
        if (!CTM) return;
        
        const clickX = (e.clientX - CTM.e) / CTM.a;
        const rawPos = pxToMeter(clickX);
        const position = Math.round(rawPos * 10) / 10;

        if (selectedTool === 'pointLoad') {
            const newLoad: PointLoad = {
                id: Math.random().toString(36).substr(2, 9),
                position: position,
                magnitude: 10
            };
            onChange({ ...beamInput, pointLoads: [...pointLoads, newLoad] });
        } else if (selectedTool === 'distLoad') {
            const end = Math.min(span, position + 1);
            const newLoad: DistributedLoad = {
                id: Math.random().toString(36).substr(2, 9),
                start: position,
                end: end,
                magnitude: 10,
                startMagnitude: 10,
                endMagnitude: 10
            };
            onChange({ ...beamInput, distributedLoads: [...distributedLoads, newLoad] });
        } else if (selectedTool === 'support') {
            const newSupport: Support = {
                id: Math.random().toString(36).substr(2, 9),
                position: position,
                type: 'pin' 
            };
            onChange({ ...beamInput, supports: [...supports, newSupport] });
        }
        setSelectedTool('none');
    };

    const startDrag = (e: React.MouseEvent, id: string, type: 'support' | 'pointLoad' | 'distLoad', startX: number) => {
        e.stopPropagation();
        setDraggingId(id);
        setDraggingType(type);
        
        const CTM = svgRef.current!.getScreenCTM()!;
        const mouseX = (e.clientX - CTM.e) / CTM.a;
        // Calculate offset so element doesn't jump to mouse center
        setDragOffset(mouseX - startX); 
    };

    const updatePointLoad = (id: string, field: keyof PointLoad, value: number) => {
        const newLoads = pointLoads.map(p => p.id === id ? { ...p, [field]: value } : p);
        onChange({ ...beamInput, pointLoads: newLoads });
    };

    const removePointLoad = (id: string) => {
        onChange({ ...beamInput, pointLoads: pointLoads.filter(p => p.id !== id) });
    };

    const updateDistLoad = (id: string, field: keyof DistributedLoad, value: number) => {
        const newLoads = distributedLoads.map(d => {
            if(d.id !== id) return d;
            let updates: any = { [field]: value };
            return { ...d, ...updates };
        });
        onChange({ ...beamInput, distributedLoads: newLoads });
    };

    const removeDistLoad = (id: string) => {
        onChange({ ...beamInput, distributedLoads: distributedLoads.filter(d => d.id !== id) });
    };

    const updateSupport = (id: string, field: keyof Support, value: any) => {
        const newSupports = supports.map(s => s.id === id ? { ...s, [field]: value } : s);
        onChange({ ...beamInput, supports: newSupports });
    };

    const removeSupport = (id: string) => {
         onChange({ ...beamInput, supports: supports.filter(s => s.id !== id) });
    };

    const SupportIcon = ({ type, x, y, isDragging }: { type: SupportType, x: number, y: number, isDragging: boolean }) => {
        const style = { 
            cursor: isDragging ? 'grabbing' : 'grab', 
            transition: 'transform 0.1s',
            transform: isDragging ? 'scale(1.1)' : 'scale(1)',
            transformOrigin: `${x}px ${y}px`
        };

        if (type === 'fixed') {
            return (
                <g style={style}>
                    <rect x={x - 8} y={y} width={16} height={20} fill="#1e293b" />
                    <line x1={x - 12} y1={y + 20} x2={x + 12} y2={y + 20} stroke="#1e293b" strokeWidth="2" />
                     <line x1={x-12} y1={y+20} x2={x-15} y2={y+25} stroke="#94a3b8" strokeWidth="1"/>
                     <line x1={x-4} y1={y+20} x2={x-7} y2={y+25} stroke="#94a3b8" strokeWidth="1"/>
                     <line x1={x+4} y1={y+20} x2={x+1} y2={y+25} stroke="#94a3b8" strokeWidth="1"/>
                     <line x1={x+12} y1={y+20} x2={x+9} y2={y+25} stroke="#94a3b8" strokeWidth="1"/>
                </g>
            );
        } else if (type === 'roller') {
             return (
                <g style={style}>
                    <path d={`M ${x} ${y} l -10 15 l 20 0 z`} fill="#0f172a" />
                    <circle cx={x-6} cy={y+18} r={3} fill="white" stroke="#0f172a" strokeWidth="1"/>
                    <circle cx={x+6} cy={y+18} r={3} fill="white" stroke="#0f172a" strokeWidth="1"/>
                    <line x1={x - 15} y1={y + 22} x2={x + 15} y2={y + 22} stroke="#cbd5e1" strokeWidth="2" />
                </g>
             );
        }
        return (
             <g style={style}>
                <path d={`M ${x} ${y} l -10 15 l 20 0 z`} fill="#0f172a" />
                <line x1={x - 15} y1={y + 17} x2={x + 15} y2={y + 17} stroke="#cbd5e1" strokeWidth="2" />
                 <line x1={x-10} y1={y+17} x2={x-13} y2={y+22} stroke="#94a3b8" strokeWidth="1"/>
                 <line x1={x} y1={y+17} x2={x-3} y2={y+22} stroke="#94a3b8" strokeWidth="1"/>
                 <line x1={x+10} y1={y+17} x2={x+7} y2={y+22} stroke="#94a3b8" strokeWidth="1"/>
            </g>
        );
    };

    const beamY = height/2;
    const beamThickness = 10;
    const beamTopY = beamY - beamThickness/2;

    const isStable = supports.length >= 2 || (supports.length === 1 && supports[0].type === 'fixed');

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 select-none">
            {/* Toolbar */}
            <div className="flex gap-2 mb-4 justify-center flex-wrap">
                 <button
                    onClick={() => setSelectedTool(selectedTool === 'support' ? 'none' : 'support')}
                    className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTool === 'support' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border hover:bg-slate-100'}`}
                >
                    <Triangle className="w-4 h-4 mr-2" />
                    + Apoio
                </button>
                <button
                    onClick={() => setSelectedTool(selectedTool === 'pointLoad' ? 'none' : 'pointLoad')}
                    className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTool === 'pointLoad' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border hover:bg-slate-100'}`}
                >
                    <ArrowDown className="w-4 h-4 mr-2" />
                    + Carga Pontual
                </button>
                <button
                    onClick={() => setSelectedTool(selectedTool === 'distLoad' ? 'none' : 'distLoad')}
                    className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTool === 'distLoad' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border hover:bg-slate-100'}`}
                >
                    <BoxSelect className="w-4 h-4 mr-2" />
                    + Carga Dist.
                </button>
            </div>
            
            {/* Canvas */}
            <div id="beam-diagram-container" className="relative border border-slate-200 bg-white rounded-lg overflow-hidden shadow-inner cursor-crosshair">
                <svg 
                    ref={svgRef}
                    viewBox={`0 0 ${width} ${height}`} 
                    className="w-full h-auto"
                    onClick={handleSvgClick}
                >
                    <line x1={paddingX} y1={height - 40} x2={width - paddingX} y2={height - 40} stroke="#cbd5e1" strokeWidth="1" />
                    {Array.from({length: Math.ceil(span) + 1}).map((_, i) => (
                        <g key={i}>
                            <line x1={meterToPx(i)} y1={height - 40} x2={meterToPx(i)} y2={height - 35} stroke="#94a3b8" strokeWidth="1" />
                            <text x={meterToPx(i)} y={height - 20} textAnchor="middle" fontSize="10" fill="#64748b">{i}m</text>
                        </g>
                    ))}
                    
                    <rect 
                        x={paddingX} 
                        y={beamTopY} 
                        width={width - 2*paddingX} 
                        height={beamThickness} 
                        fill="#475569" 
                        rx={2}
                    />

                    {/* Supports */}
                    {supports.map((s) => (
                        <g 
                            key={s.id} 
                            onMouseDown={(e) => startDrag(e, s.id, 'support', meterToPx(s.position))}
                        >
                           <SupportIcon 
                                type={s.type} 
                                x={meterToPx(s.position)} 
                                y={beamTopY + beamThickness} 
                                isDragging={draggingId === s.id}
                           />
                           <rect 
                                x={meterToPx(s.position) - 15} 
                                y={beamTopY} 
                                width={30} 
                                height={40} 
                                fill="transparent" 
                                style={{cursor: 'grab'}}
                           />
                        </g>
                    ))}

                    {/* Distributed Loads */}
                    {distributedLoads.map((d) => {
                        const startX = meterToPx(d.start);
                        const endX = meterToPx(d.end);
                        const startH = getLoadHeight(d.startMagnitude);
                        const endH = getLoadHeight(d.endMagnitude);
                        const loadBottomY = beamTopY;
                        
                        const p1 = `${startX},${loadBottomY - startH}`;
                        const p2 = `${endX},${loadBottomY - endH}`;
                        const p3 = `${endX},${loadBottomY}`;
                        const p4 = `${startX},${loadBottomY}`;

                        return (
                            <g 
                                key={d.id} 
                                className="group cursor-grab active:cursor-grabbing"
                                onMouseDown={(e) => startDrag(e, d.id, 'distLoad', startX)}
                            >
                                <polygon points={`${p1} ${p2} ${p3} ${p4}`} fill="url(#diagonalHatch)" stroke="#ef4444" strokeWidth="1" opacity={draggingId === d.id ? 0.6 : 0.3} />
                                <line x1={startX} y1={loadBottomY - startH} x2={endX} y2={loadBottomY - endH} stroke="#ef4444" strokeWidth="2" />
                                <line x1={startX} y1={loadBottomY - startH} x2={startX} y2={loadBottomY} stroke="#ef4444" strokeWidth="1" />
                                <line x1={endX} y1={loadBottomY - endH} x2={endX} y2={loadBottomY} stroke="#ef4444" strokeWidth="1" />
                                
                                <text x={startX} y={loadBottomY - startH - 5} textAnchor="middle" fontSize="10" fill="#ef4444" fontWeight="bold">{d.startMagnitude}</text>
                                {Math.abs(d.startMagnitude - d.endMagnitude) > 0.1 && (
                                    <text x={endX} y={loadBottomY - endH - 5} textAnchor="middle" fontSize="10" fill="#ef4444" fontWeight="bold">{d.endMagnitude}</text>
                                )}
                                {/* Invisible handle for easy grab */}
                                <rect x={startX} y={loadBottomY - 60} width={endX-startX} height={60} fill="transparent" />
                            </g>
                        );
                    })}

                    {/* Point Loads */}
                    {pointLoads.map((p) => {
                        const x = meterToPx(p.position);
                        const loadHeight = getLoadHeight(p.magnitude);
                        const tipY = beamTopY; 
                        const tailY = tipY - Math.max(20, loadHeight);
                        return (
                            <g 
                                key={p.id} 
                                className="cursor-grab active:cursor-grabbing"
                                onMouseDown={(e) => startDrag(e, p.id, 'pointLoad', x)}
                            >
                                 <line x1={x} y1={tailY} x2={x} y2={tipY} stroke="#2563eb" strokeWidth="3" markerEnd="url(#arrowheadBlue)"/>
                                <text x={x} y={tailY - 5} textAnchor="middle" fontSize="11" fill="#2563eb" fontWeight="bold">{p.magnitude} kN</text>
                                <rect x={x-10} y={tailY-10} width={20} height={Math.abs(tipY-tailY)+10} fill="transparent"/>
                            </g>
                        );
                    })}

                    <defs>
                        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#ef4444" /></marker>
                        <marker id="arrowheadBlue" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#2563eb" /></marker>
                        <pattern id="diagonalHatch" width="4" height="4" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="4" style={{stroke:'#ef4444', strokeWidth:1}} /></pattern>
                    </defs>
                </svg>
            </div>

            {/* Inputs Table */}
            <div className="mt-6 space-y-4">
                 {/* Supports List */}
                 <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                     <div className="flex justify-between items-center mb-2">
                        <h4 className="text-xs font-bold uppercase text-slate-500">Apoios</h4>
                     </div>
                     {supports.length > 0 ? (
                         <div className="grid gap-2">
                             {supports.map((s, idx) => (
                                 <div key={s.id} className="flex items-center gap-2 text-sm">
                                     <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
                                     <span className="w-6 text-slate-400 font-mono">#{idx+1}</span>
                                     <select 
                                        value={s.type}
                                        onChange={(e) => updateSupport(s.id, 'type', e.target.value)}
                                        className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs"
                                     >
                                         <option value="pin">Fixo/Rotulado</option>
                                         <option value="roller">Móvel</option>
                                         <option value="fixed">Engastado</option>
                                     </select>
                                     <div className="flex items-center gap-1">
                                        <span className="text-slate-400 text-xs">Pos:</span>
                                        <input 
                                            type="number" step="0.1" min="0" max={span}
                                            value={s.position}
                                            onChange={(e) => updateSupport(s.id, 'position', parseFloat(e.target.value))}
                                            className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs"
                                        />
                                        <span className="text-slate-400 text-xs">m</span>
                                     </div>
                                     <button onClick={() => removeSupport(s.id)} className="ml-auto text-rose-500 hover:bg-rose-50 p-1 rounded"><Trash2 className="w-3 h-3"/></button>
                                 </div>
                             ))}
                         </div>
                     ) : (
                        <p className="text-sm text-slate-400 italic">Nenhum apoio adicionado.</p>
                     )}
                     {!isStable && <p className="text-xs text-rose-600 mt-2 font-bold flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> Estrutura instável.</p>}
                </div>
                
                <div className="space-y-3">
                    {/* Point Loads Input */}
                    {pointLoads.map((p, idx) => (
                        <div key={p.id} className="bg-white p-2 rounded-lg border border-blue-100 shadow-sm flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
                                <span className="text-xs font-bold text-blue-600 whitespace-nowrap">P#{idx+1}</span>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1 text-xs">
                                        <span className="text-slate-400 w-6">Pos:</span>
                                        <input type="number" step="0.1" value={p.position} onChange={(e) => updatePointLoad(p.id, 'position', parseFloat(e.target.value))} className="w-14 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-center"/> <span className="text-slate-400">m</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs mt-1">
                                        <span className="text-slate-400 w-6">Val:</span>
                                        <input type="number" step="1" value={p.magnitude} onChange={(e) => updatePointLoad(p.id, 'magnitude', parseFloat(e.target.value))} className="w-14 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded text-center"/> <span className="text-slate-400">kN</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => removePointLoad(p.id)} className="text-slate-400 hover:text-rose-500 p-1"><Trash2 className="w-3 h-3"/></button>
                        </div>
                    ))}

                    {/* Distributed Loads Input */}
                    {distributedLoads.map((d, idx) => (
                        <div key={d.id} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm relative">
                            <div className="flex justify-between items-center mb-2 border-b border-red-50 pb-1">
                                <div className="flex items-center gap-2">
                                    <GripVertical className="w-4 h-4 text-slate-300 cursor-grab" />
                                    <span className="text-xs font-bold text-red-600 flex items-center gap-1"><BoxSelect className="w-3 h-3"/>Carga Dist. #{idx+1}</span>
                                </div>
                                <button onClick={() => removeDistLoad(d.id)} className="text-slate-400 hover:text-rose-500"><Trash2 className="w-3 h-3"/></button>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded border border-slate-100" title="Posição">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Posição</span>
                                    <div className="flex items-center gap-1"><ArrowRightFromLine className="w-3 h-3 text-slate-400" /><input type="number" step="0.1" value={d.start} onChange={(e) => updateDistLoad(d.id, 'start', parseFloat(e.target.value))} className="w-14 px-1 py-1 text-xs bg-white border border-slate-200 rounded text-center"/></div>
                                    <span className="text-slate-300">-</span>
                                    <div className="flex items-center gap-1"><ArrowRightToLine className="w-3 h-3 text-slate-400" /><input type="number" step="0.1" value={d.end} onChange={(e) => updateDistLoad(d.id, 'end', parseFloat(e.target.value))} className="w-14 px-1 py-1 text-xs bg-white border border-slate-200 rounded text-center"/></div>
                                </div>
                                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded border border-slate-100" title="Carga (Permite Trapezoidal)">
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Carga</span>
                                    <div className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-slate-400" /><input type="number" step="1" value={d.startMagnitude} onChange={(e) => updateDistLoad(d.id, 'startMagnitude', parseFloat(e.target.value))} className="w-14 px-1 py-1 text-xs bg-white border border-slate-200 rounded text-center"/></div>
                                    <span className="text-slate-300">→</span>
                                    <div className="flex items-center gap-1"><TrendingDown className="w-3 h-3 text-slate-400" /><input type="number" step="1" value={d.endMagnitude} onChange={(e) => updateDistLoad(d.id, 'endMagnitude', parseFloat(e.target.value))} className="w-14 px-1 py-1 text-xs bg-white border border-slate-200 rounded text-center"/></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="mt-4 flex items-start gap-2 text-xs text-slate-400">
                <div className="bg-blue-50 text-blue-500 p-1 rounded"><Move className="w-3 h-3"/></div>
                <p>Arraste os elementos (Apoios ou Cargas) no diagrama para mover. Edite os valores numéricos para precisão.</p>
            </div>
        </div>
    );
};

export default BeamEditor;