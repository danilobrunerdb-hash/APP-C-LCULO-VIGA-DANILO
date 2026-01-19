import React, { useState, useEffect } from 'react';
import { CalculationResult, ElementType } from '../types';
import { AlertTriangle, CheckCircle, Info, FileDown, Activity, Box, Layers, Loader2, Cuboid, ScanLine, Maximize2, X, FileCode, ArrowUpDown } from 'lucide-react';
import { generateReport } from '../utils/pdfGenerator';
import { generateCrossSectionDXF } from '../utils/dxfGenerator';
import CrossSection from './CrossSection';
import Beam3DViewer from './Beam3DViewer';
import BeamLongitudinalViewer from './BeamLongitudinalViewer';
import Column3DViewer from './Column3DViewer';
import ColumnLongitudinalViewer from './ColumnLongitudinalViewer';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Label,
  LineChart,
  Line
} from 'recharts';

interface ResultsCardProps {
  result: CalculationResult | null;
  title: string;
  type: ElementType;
  inputData: any;
}

const ResultsCard: React.FC<ResultsCardProps> = ({ result, title, type, inputData }) => {
  const [activeChart, setActiveChart] = useState<'normal' | 'moment' | 'buckling'>('normal'); // Added buckling
  const [showMemory, setShowMemory] = useState(false);
  const [activeView, setActiveView] = useState<'2d' | '3d' | 'side'>('2d');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [invertMoment, setInvertMoment] = useState(false); // State to invert moment chart
  
  // State for Full Screen Modal
  const [fullScreenContent, setFullScreenContent] = useState<{ title: string, content: React.ReactNode } | null>(null);

  if (!result) return null;

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    // Pequeno delay para permitir renderização de estados se necessário
    setTimeout(async () => {
        try {
            await generateReport(type, inputData, result);
        } catch (error) {
            console.error("Erro ao gerar PDF", error);
            alert("Erro ao gerar o relatório. Tente novamente.");
        } finally {
            setIsGeneratingPdf(false);
        }
    }, 100);
  };

  const handleDownloadDxf = () => {
      if (!result.crossSection) return;
      
      const dxfContent = generateCrossSectionDXF(result.crossSection);
      // text/plain com utf-8 é seguro para ASCII DXF
      const blob = new Blob([dxfContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Garante extensão .dxf
      link.download = `secao_${type === ElementType.BEAM ? 'viga' : 'pilar'}.dxf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  // Helper to get Min/Max for charts to draw ReferenceLines
  const getExtremes = (data: any[] | undefined, key: string) => {
      if (!data || data.length === 0) return { min: 0, max: 0 };
      const values = data.map(d => parseFloat(d[key]));
      return {
          min: Math.min(...values),
          max: Math.max(...values)
      };
  };

  const openFullScreen = (title: string, content: React.ReactNode) => {
      setFullScreenContent({ title, content });
  };

  const renderBeamCharts = (isFullScreen: boolean = false) => {
      const momentExtremes = getExtremes(result.chartDataMoment, 'moment');
      const shearExtremes = getExtremes(result.chartDataShear, 'shear');
      const deflectionExtremes = getExtremes(result.chartDataDeflection, 'deflection');

      const chartHeight = isFullScreen ? "33%" : "128px";
      const containerClass = isFullScreen ? "h-full flex flex-col gap-8 p-4" : "space-y-6";

      return (
        <div className={containerClass}>
            {/* Moment Chart */}
            <div className={isFullScreen ? "flex-1 min-h-0" : ""}>
                <div className="flex justify-between items-center mb-2 pl-2 border-l-2 border-blue-500">
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-blue-600">Momento Fletor (kN.m)</p>
                        <button 
                            onClick={() => setInvertMoment(!invertMoment)}
                            className={`p-1 rounded-md transition-colors ${invertMoment ? 'bg-blue-100 text-blue-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                            title="Inverter Gráfico (Convenção Estrutural)"
                        >
                            <ArrowUpDown className="w-3 h-3" />
                        </button>
                    </div>
                    {!isFullScreen && (
                        <button onClick={() => openFullScreen("Diagramas de Esforços", renderBeamCharts(true))} className="text-slate-400 hover:text-blue-600">
                            <Maximize2 className="w-3 h-3"/>
                        </button>
                    )}
                </div>
                <div style={{ height: isFullScreen ? "90%" : "128px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%" id="chart-container-moment">
                        <AreaChart data={result.chartDataMoment}>
                            <defs>
                                <linearGradient id="colorMoment" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="x" tick={{fontSize: 10}} hide={!isFullScreen} />
                            <YAxis tick={{fontSize: 10}} width={35} reversed={invertMoment} />
                            <Tooltip contentStyle={{borderRadius: '8px', fontSize: '12px'}} />
                            <ReferenceLine y={momentExtremes.max} stroke="#1e40af" strokeDasharray="3 3">
                                <Label value={`Máx: ${momentExtremes.max.toFixed(2)}`} position="insideTopRight" fontSize={10} fill="#1e40af" />
                            </ReferenceLine>
                            <ReferenceLine y={momentExtremes.min} stroke="#1e40af" strokeDasharray="3 3">
                                <Label value={`Mín: ${momentExtremes.min.toFixed(2)}`} position="insideBottomRight" fontSize={10} fill="#1e40af" />
                            </ReferenceLine>
                            <Area type="monotone" dataKey="moment" stroke="#2563eb" fill="url(#colorMoment)" name="Momento" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Shear Chart */}
            <div className={isFullScreen ? "flex-1 min-h-0" : ""}>
                <div className="flex justify-between items-center mb-2 pl-2 border-l-2 border-orange-500">
                    <p className="text-xs font-semibold text-orange-600">Cortante (kN)</p>
                </div>
                <div style={{ height: isFullScreen ? "90%" : "128px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%" id="chart-container-shear">
                        <AreaChart data={result.chartDataShear}>
                            <defs>
                                <linearGradient id="colorShear" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ea580c" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="x" tick={{fontSize: 10}} hide={!isFullScreen}/>
                            <YAxis tick={{fontSize: 10}} width={35} />
                            <Tooltip contentStyle={{borderRadius: '8px', fontSize: '12px'}} />
                            <ReferenceLine y={shearExtremes.max} stroke="#c2410c" strokeDasharray="3 3">
                                <Label value={`Máx: ${shearExtremes.max.toFixed(2)}`} position="insideTopRight" fontSize={10} fill="#c2410c" />
                            </ReferenceLine>
                            <ReferenceLine y={shearExtremes.min} stroke="#c2410c" strokeDasharray="3 3">
                                <Label value={`Mín: ${shearExtremes.min.toFixed(2)}`} position="insideBottomRight" fontSize={10} fill="#c2410c" />
                            </ReferenceLine>
                            <Area type="monotone" dataKey="shear" stroke="#ea580c" fill="url(#colorShear)" name="Cortante" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

                {/* Deflection Chart */}
            <div className={isFullScreen ? "flex-1 min-h-0" : ""}>
                <div className="flex justify-between items-center mb-2 pl-2 border-l-2 border-violet-500">
                    <p className="text-xs font-semibold text-violet-600">Deflexão (cm)</p>
                </div>
                <div style={{ height: isFullScreen ? "90%" : "128px", width: "100%" }}>
                    <ResponsiveContainer width="100%" height="100%" id="chart-container-deflection">
                        <AreaChart data={result.chartDataDeflection}>
                            <defs>
                                <linearGradient id="colorDeflection" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="x" tick={{fontSize: 10}} />
                            <YAxis tick={{fontSize: 10}} width={35} />
                            <Tooltip contentStyle={{borderRadius: '8px', fontSize: '12px'}} />
                            <ReferenceLine y={deflectionExtremes.max} stroke="#7c3aed" strokeDasharray="3 3">
                                 <Label value={`Máx: ${deflectionExtremes.max.toFixed(3)}`} position="insideBottomRight" fontSize={10} fill="#7c3aed" />
                            </ReferenceLine>
                            <ReferenceLine y={deflectionExtremes.min} stroke="#7c3aed" strokeDasharray="3 3">
                                 <Label value={`Mín: ${deflectionExtremes.min.toFixed(3)}`} position="insideTopRight" fontSize={10} fill="#7c3aed" />
                            </ReferenceLine>
                            <Area type="monotone" dataKey="deflection" stroke="#8b5cf6" fill="url(#colorDeflection)" name="Flecha" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
      );
  };

  // Update modal content if invertMoment changes while modal is open
  useEffect(() => {
      if (fullScreenContent && fullScreenContent.title === "Diagramas de Esforços") {
          setFullScreenContent({
              title: "Diagramas de Esforços",
              content: renderBeamCharts(true)
          });
      }
  }, [invertMoment]);

  const renderColumnCharts = (isFullScreen: boolean = false) => {
      const normalExtremes = getExtremes(result.chartDataNormal, 'normal');
      const momentExtremes = getExtremes(result.chartDataMoment, 'moment');
      const bucklingExtremes = getExtremes(result.chartDataBuckling, 'deflection');

      return (
        <div className={isFullScreen ? "h-full w-full p-4 flex flex-col" : "flex flex-col h-full"}>
             {!isFullScreen && (
                 <div className="flex space-x-2 bg-slate-100 p-1 rounded-lg mb-4">
                     <button
                        onClick={() => setActiveChart('normal')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeChart === 'normal' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                        Normal (N)
                     </button>
                     <button
                        onClick={() => setActiveChart('moment')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeChart === 'moment' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                        Momento (M)
                     </button>
                     <button
                        onClick={() => setActiveChart('buckling')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${activeChart === 'buckling' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                        Flambagem
                     </button>
                     <div className="flex-1"></div>
                     <button onClick={() => openFullScreen("Diagramas do Pilar", renderColumnCharts(true))} className="text-slate-400 hover:text-blue-600 p-1">
                        <Maximize2 className="w-3 h-3"/>
                     </button>
                 </div>
             )}
             
             {isFullScreen && (
                 <div className="flex justify-center gap-4 mb-4">
                      <button onClick={() => setActiveChart('normal')} className={`px-4 py-2 rounded ${activeChart === 'normal' ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>Normal</button>
                      <button onClick={() => setActiveChart('moment')} className={`px-4 py-2 rounded ${activeChart === 'moment' ? 'bg-blue-600 text-white' : 'bg-slate-200'}`}>Momento</button>
                      <button onClick={() => setActiveChart('buckling')} className={`px-4 py-2 rounded ${activeChart === 'buckling' ? 'bg-violet-600 text-white' : 'bg-slate-200'}`}>Flambagem</button>
                 </div>
             )}

             <div style={{ height: isFullScreen ? "90%" : "300px", width: "100%" }}>
                <ResponsiveContainer width="100%" height="100%">
                    {activeChart === 'normal' ? (
                        <AreaChart layout="vertical" data={result.chartDataNormal} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <defs>
                                <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                            <XAxis type="number" tick={{fontSize: 10}} />
                            <YAxis dataKey="x" type="number" tick={{fontSize: 10}} label={{ value: 'Altura (m)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip contentStyle={{borderRadius: '8px', fontSize: '12px'}} cursor={{strokeDasharray: '3 3'}} />
                            <ReferenceLine x={normalExtremes.max} stroke="#047857" strokeDasharray="3 3">
                                <Label value={`Máx: ${normalExtremes.max.toFixed(2)}`} position="insideTopRight" fontSize={10} fill="#047857" />
                            </ReferenceLine>
                            <Area type="step" dataKey="normal" stroke="#059669" fill="url(#colorNormal)" name="Normal (kN)" />
                        </AreaChart>
                    ) : activeChart === 'moment' ? (
                         <AreaChart layout="vertical" data={result.chartDataMoment} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                            <XAxis type="number" tick={{fontSize: 10}} />
                            <YAxis dataKey="x" type="number" tick={{fontSize: 10}} label={{ value: 'Altura (m)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip contentStyle={{borderRadius: '8px', fontSize: '12px'}} cursor={{strokeDasharray: '3 3'}} />
                             <ReferenceLine x={momentExtremes.max} stroke="#1e40af" strokeDasharray="3 3">
                                <Label value={`Máx: ${momentExtremes.max.toFixed(2)}`} position="insideTopRight" fontSize={10} fill="#1e40af" />
                            </ReferenceLine>
                            <Area type="monotone" dataKey="moment" stroke="#2563eb" fill="url(#colorMoment)" name="Momento" />
                        </AreaChart>
                    ) : (
                        <LineChart layout="vertical" data={result.chartDataBuckling} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                            <XAxis type="number" tick={{fontSize: 10}} label={{ value: 'Deslocamento (cm)', position: 'insideBottom', offset: -5 }}/>
                            <YAxis dataKey="x" type="number" tick={{fontSize: 10}} label={{ value: 'Altura (m)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip contentStyle={{borderRadius: '8px', fontSize: '12px'}} cursor={{strokeDasharray: '3 3'}} />
                            {/* Axis Line */}
                            <ReferenceLine x={0} stroke="#94a3b8" strokeDasharray="3 3" />
                            
                            <ReferenceLine x={bucklingExtremes.max} stroke="#7c3aed" strokeDasharray="3 3">
                                <Label value={`Máx: ${bucklingExtremes.max.toFixed(3)}`} position="insideTopRight" fontSize={10} fill="#7c3aed" />
                            </ReferenceLine>
                            <Line type="monotone" dataKey="deflection" stroke="#8b5cf6" strokeWidth={3} dot={false} name="Desloc. Lateral" />
                        </LineChart>
                    )}
                </ResponsiveContainer>
             </div>
        </div>
      );
  };

  const renderVisualizationContent = (isFullScreen: boolean = false) => {
      if (!result.crossSection) return null;
      
      return (
        <div className={`w-full flex justify-center items-center ${isFullScreen ? 'h-full overflow-auto bg-slate-50 p-8' : ''}`}>
             <div className={`${activeView === '2d' ? 'block' : 'hidden'} w-full flex justify-center`}>
                <CrossSection details={result.crossSection} isFullScreen={isFullScreen} />
            </div>
            <div className={`${activeView === '3d' ? 'block' : 'hidden'} w-full flex justify-center`}>
                {type === ElementType.BEAM ? (
                    <Beam3DViewer details={result.crossSection} />
                ) : (
                    <Column3DViewer details={result.crossSection} />
                )}
            </div>
            <div id="longitudinal-view-container" className={`${activeView === 'side' ? 'block' : 'hidden'} w-full flex justify-center bg-white p-2`}>
                {type === ElementType.BEAM ? (
                    <BeamLongitudinalViewer details={result.crossSection} span={inputData.span} />
                ) : (
                    <ColumnLongitudinalViewer details={result.crossSection} height={inputData.height} />
                )}
            </div>
        </div>
      );
  };

  return (
    <>
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-fade-in relative">
        {/* Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            <div className="flex items-center space-x-3">
            {result.isValid ? (
                <span className="flex items-center text-emerald-600 text-sm font-medium bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Válido
                </span>
            ) : (
                <span className="flex items-center text-rose-600 text-sm font-medium bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
                <AlertTriangle className="w-4 h-4 mr-1.5" />
                Verificar
                </span>
            )}
            <button 
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="flex items-center text-slate-600 hover:text-blue-600 transition-colors p-1.5 hover:bg-blue-50 rounded-md disabled:opacity-50"
                title="Baixar Relatório PDF"
            >
                {isGeneratingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
            </button>
            </div>
        </div>
        
        {/* Tabs for Memory */}
        <div className="flex border-b border-slate-200 bg-slate-50/50">
            <button
                onClick={() => setShowMemory(false)}
                className={`flex-1 py-2 text-sm font-medium border-b-2 ${!showMemory ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                Resultados Gerais
            </button>
            <button
                onClick={() => setShowMemory(true)}
                className={`flex-1 py-2 text-sm font-medium border-b-2 ${showMemory ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
                Memorial de Cálculo
            </button>
        </div>

        <div className="p-6">
            {/* Memory View - Hidden via CSS when not active to preserve DOM for PDF generation */}
            <div className={showMemory ? 'block' : 'hidden'}>
                <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 font-mono text-sm text-slate-700 h-96 overflow-y-auto">
                        {result.calculationMemory && result.calculationMemory.length > 0 ? (
                            result.calculationMemory.map((line, idx) => (
                                <p key={idx} className={`mb-1 ${line.startsWith('#') ? 'font-bold text-slate-900 mt-4 text-base' : ''} ${line.startsWith('-') ? 'ml-4' : ''}`}>
                                    {line.replace(/#/g, '')}
                                </p>
                            ))
                        ) : (
                            <p className="text-slate-400 italic">Memorial de cálculo não disponível para este elemento.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Results View - Hidden via CSS when not active */}
            <div className={!showMemory ? 'block' : 'hidden'}>
                {/* Messages */}
                {result.messages.length > 0 && (
                <div className="mb-6 space-y-2">
                    {result.messages.map((msg, idx) => (
                    <div key={idx} className="flex items-start p-3 bg-amber-50 text-amber-800 text-sm rounded-lg border border-amber-100">
                        <Info className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        <span>{msg}</span>
                    </div>
                    ))}
                </div>
                )}

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {result.metrics.map((metric, idx) => (
                    <div key={idx} className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{metric.label}</p>
                    <div className="mt-1 flex items-baseline">
                        <span className="text-2xl font-bold text-slate-900">{metric.value}</span>
                        <span className="ml-1 text-sm text-slate-600 font-medium">{metric.unit}</span>
                    </div>
                    {metric.description && (
                        <p className="mt-1 text-xs text-slate-400">{metric.description}</p>
                    )}
                    </div>
                ))}
                </div>

                {/* Alternatives Section */}
                {result.alternativeReinforcement && result.alternativeReinforcement.length > 0 && (
                    <div className="mb-8 border border-slate-100 rounded-lg overflow-hidden">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center">
                                <Layers className="w-4 h-4 mr-2" />
                                Alternativas de Armadura
                            </h4>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Diâmetro</th>
                                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Quantidade</th>
                                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Área Total</th>
                                        <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Camadas</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {result.alternativeReinforcement.map((alt, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-2 text-sm font-medium text-slate-900">ø {alt.diameter} mm</td>
                                            <td className="px-4 py-2 text-sm text-slate-700">{alt.count} barras</td>
                                            <td className="px-4 py-2 text-sm text-slate-700">{alt.area.toFixed(2)} cm²</td>
                                            <td className="px-4 py-2 text-sm text-slate-700">
                                                {alt.layers > 1 ? (
                                                    <span className="text-amber-600 font-medium">{alt.layers} camadas</span>
                                                ) : (
                                                    <span className="text-slate-500">1 camada</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-t border-slate-100 pt-6">
                    {/* Visualização da Seção Transversal e 3D */}
                    {result.crossSection && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-semibold text-slate-700 flex items-center">
                                    <Box className="w-4 h-4 mr-2" />
                                    Detalhamento da Armadura
                                </h4>
                                
                                <div className="flex items-center gap-2">
                                    <div className="flex space-x-1 bg-slate-100 p-0.5 rounded-lg">
                                        <button
                                            onClick={() => setActiveView('2d')}
                                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center ${
                                                activeView === '2d' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            <Box className="w-3 h-3 mr-1" /> Seção 2D
                                        </button>
                                        
                                        <button
                                            onClick={() => setActiveView('side')}
                                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center ${
                                                activeView === 'side' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            <ScanLine className="w-3 h-3 mr-1" /> Vista Lateral
                                        </button>
                                        
                                        <button
                                            onClick={() => setActiveView('3d')}
                                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center ${
                                                activeView === '3d' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            <Cuboid className="w-3 h-3 mr-1" /> Visão 3D
                                        </button>
                                    </div>
                                    <button 
                                        onClick={handleDownloadDxf}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition-colors"
                                        title="Baixar DXF (CAD)"
                                    >
                                        <FileCode className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => openFullScreen("Visualização Detalhada", renderVisualizationContent(true))}
                                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-100 transition-colors"
                                        title="Tela Cheia"
                                    >
                                        <Maximize2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex justify-center bg-slate-50/50 p-4 rounded-xl border border-slate-100 min-h-[320px] items-center relative">
                                {renderVisualizationContent(false)}
                            </div>
                        </div>
                    )}

                    {/* Gráficos */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold text-slate-700 flex items-center">
                                <Activity className="w-4 h-4 mr-2" />
                                Diagramas de Esforços
                            </h4>
                        </div>
                        
                        {type === ElementType.BEAM ? renderBeamCharts(false) : renderColumnCharts(false)}
                    </div>
                </div>
            </div>
        </div>
        </div>

        {/* Full Screen Modal */}
        {fullScreenContent && (
            <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in duration-200">
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
                    <h2 className="text-lg font-bold text-slate-800">{fullScreenContent.title}</h2>
                    <button 
                        onClick={() => setFullScreenContent(null)}
                        className="p-2 bg-white hover:bg-slate-200 rounded-full transition-colors shadow-sm text-slate-600"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="flex-1 overflow-auto p-6 bg-slate-100">
                    <div className="bg-white rounded-xl shadow-lg h-full p-4">
                        {fullScreenContent.content}
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

export default ResultsCard;