import React, { useState } from 'react';
import { Ruler, Columns, Construction, Calculator, Info } from 'lucide-react';
import { BeamInput, ColumnInput, ElementType, CalculationResult, SteelType, SupportCondition, BAR_DIAMETERS, STIRRUP_DIAMETERS } from './types';
import { calculateBeam, calculateColumn } from './utils/calculations';
import ResultsCard from './components/ResultsCard';
import AIAnalysis from './components/AIAnalysis';
import BeamEditor from './components/BeamEditor';

function App() {
  const [activeTab, setActiveTab] = useState<ElementType>(ElementType.BEAM);
  
  // State for Beam Inputs
  const [beamInput, setBeamInput] = useState<BeamInput>({
    span: 5.0,
    pointLoads: [],
    distributedLoads: [
        { id: 'dl1', start: 0, end: 5, magnitude: 15, startMagnitude: 15, endMagnitude: 15 }
    ],
    supports: [
        { id: 's1', position: 0, type: 'pin' },
        { id: 's2', position: 5, type: 'pin' }
    ],
    width: 20,
    height: 40,
    fck: 25,
    steelType: SteelType.CA50,
    fyk: 500,
    concreteCover: 2.5,
    longitudinalBarDiameter: 10.0,
    topBarDiameter: 8.0, 
    stirrupDiameter: 5.0,
    stirrupSpacing: 15,
    stirrupHookAngle: 90,
    layers: 1
  });

  // State for Column Inputs
  const [columnInput, setColumnInput] = useState<ColumnInput>({
    height: 3.0,
    axialLoad: 500,
    widthX: 20,
    widthY: 20,
    fck: 25,
    steelType: SteelType.CA50,
    fyk: 500,
    supportCondition: SupportCondition.PINNED_PINNED,
    longitudinalBarDiameter: 10.0,
    stirrupDiameter: 5.0,
    stirrupSpacing: 15
  });

  const [result, setResult] = useState<CalculationResult | null>(null);

  const getFykFromSteelType = (type: SteelType): number => {
    switch(type) {
      case SteelType.CA25: return 250;
      case SteelType.CA50: return 500;
      case SteelType.CA60: return 600;
      default: return 500;
    }
  };

  const handleBeamCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const res = calculateBeam(beamInput);
    setResult(res);
  };

  const handleColumnCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const res = calculateColumn(columnInput);
    setResult(res);
  };

  const handleTabChange = (tab: ElementType) => {
    setActiveTab(tab);
    setResult(null); // Clear previous results
  };

  // Handler for Beam Steel Change
  const handleBeamSteelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as SteelType;
    setBeamInput({
      ...beamInput,
      steelType: type,
      fyk: getFykFromSteelType(type)
    });
  };

  // Handler for Column Steel Change
  const handleColumnSteelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as SteelType;
    setColumnInput({
      ...columnInput,
      steelType: type,
      fyk: getFykFromSteelType(type)
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Construction className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">CalcStruct NBR</h1>
              <p className="text-xs text-slate-400 font-medium">Pré-dimensionamento NBR 6118</p>
            </div>
          </div>
          <div className="hidden md:flex text-sm text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
            v2.3 • Flambagem & Estribos
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Navigation Tabs */}
        <div className="flex space-x-2 mb-8 bg-white p-1.5 rounded-xl shadow-sm border border-slate-200 w-fit mx-auto sm:mx-0">
          <button
            onClick={() => handleTabChange(ElementType.BEAM)}
            className={`flex items-center px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === ElementType.BEAM
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Ruler className="w-4 h-4 mr-2" />
            Vigas
          </button>
          <button
            onClick={() => handleTabChange(ElementType.COLUMN)}
            className={`flex items-center px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === ElementType.COLUMN
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Columns className="w-4 h-4 mr-2" />
            Pilares
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Input Section */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center">
                  <Calculator className="w-5 h-5 mr-2 text-blue-600" />
                  Dados de Entrada
                </h2>
                <span className="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-1 rounded">
                  {activeTab}
                </span>
              </div>

              {activeTab === ElementType.BEAM ? (
                <form onSubmit={handleBeamCalculate} className="space-y-4">
                  {/* Editor Visual de Viga */}
                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Comprimento Vão Total (m)</label>
                      <input
                          type="number" step="0.1" min="1"
                          value={beamInput.span}
                          onChange={(e) => setBeamInput({...beamInput, span: parseFloat(e.target.value)})}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg mb-4"
                      />
                      <label className="block text-sm font-medium text-slate-700 mb-2">Modelagem Estrutural</label>
                      <BeamEditor beamInput={beamInput} onChange={setBeamInput} />
                  </div>

                  {/* Geometria Seção */}
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Base (cm)</label>
                      <input
                        type="number" step="1"
                        value={beamInput.width}
                        onChange={(e) => setBeamInput({...beamInput, width: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Altura (cm)</label>
                      <input
                        type="number" step="1"
                        value={beamInput.height}
                        onChange={(e) => setBeamInput({...beamInput, height: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      />
                    </div>
                  </div>

                  {/* Materiais */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Fck (MPa)</label>
                      <select 
                        value={beamInput.fck}
                        onChange={(e) => setBeamInput({...beamInput, fck: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      >
                        <option value="20">20</option>
                        <option value="25">25</option>
                        <option value="30">30</option>
                        <option value="35">35</option>
                        <option value="40">40</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Aço Long.</label>
                      <select 
                        value={beamInput.steelType}
                        onChange={handleBeamSteelChange}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      >
                        {Object.values(SteelType).map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Detalhamento */}
                   <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Barra Inf. (mm)</label>
                      <select 
                        value={beamInput.longitudinalBarDiameter}
                        onChange={(e) => setBeamInput({...beamInput, longitudinalBarDiameter: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      >
                        {BAR_DIAMETERS.map(d => <option key={d} value={d}>{d}mm</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Barra Sup. (mm)</label>
                      <select 
                        value={beamInput.topBarDiameter || beamInput.longitudinalBarDiameter}
                        onChange={(e) => setBeamInput({...beamInput, topBarDiameter: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      >
                        {BAR_DIAMETERS.map(d => <option key={d} value={d}>{d}mm</option>)}
                      </select>
                    </div>
                  </div>
                  
                  {/* Estribos */}
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Estribo (mm)</label>
                      <select 
                        value={beamInput.stirrupDiameter}
                        onChange={(e) => setBeamInput({...beamInput, stirrupDiameter: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      >
                        {STIRRUP_DIAMETERS.map(d => <option key={d} value={d}>{d}mm</option>)}
                      </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Espaçamento (cm)</label>
                        <input
                            type="number" step="1"
                            value={beamInput.stirrupSpacing}
                            onChange={(e) => setBeamInput({...beamInput, stirrupSpacing: parseFloat(e.target.value)})}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                        />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Gancho Estribo</label>
                        <select 
                            value={beamInput.stirrupHookAngle}
                            onChange={(e) => setBeamInput({...beamInput, stirrupHookAngle: parseInt(e.target.value) as 90|135})}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                        >
                            <option value={90}>90º (Padrão)</option>
                            <option value={135}>135º </option>
                        </select>
                    </div>
                     <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Cobrimento (cm)</label>
                        <input
                            type="number" step="0.5"
                            value={beamInput.concreteCover}
                            onChange={(e) => setBeamInput({...beamInput, concreteCover: parseFloat(e.target.value)})}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                        />
                    </div>
                  </div>

                   <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Máx. Camadas</label>
                      <select 
                        value={beamInput.layers}
                        onChange={(e) => setBeamInput({...beamInput, layers: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      >
                        <option value={1}>1 Camada</option>
                        <option value={2}>2 Camadas</option>
                        <option value={3}>3 Camadas</option>
                      </select>
                    </div>

                  <button type="submit" className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow transition-all transform active:scale-95">
                    Calcular Viga
                  </button>
                </form>
              ) : (
                <form onSubmit={handleColumnCalculate} className="space-y-4">
                  {/* Geometria e Carga */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Altura do Pilar (m)</label>
                    <input
                      type="number" step="0.01"
                      value={columnInput.height}
                      onChange={(e) => setColumnInput({...columnInput, height: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Condição de Apoio</label>
                    <select
                      value={columnInput.supportCondition}
                      onChange={(e) => setColumnInput({...columnInput, supportCondition: e.target.value as SupportCondition})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                    >
                      {Object.values(SupportCondition).map((cond) => (
                        <option key={cond} value={cond}>{cond}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Carga Axial Nk (kN)</label>
                    <input
                      type="number" step="10"
                      value={columnInput.axialLoad}
                      onChange={(e) => setColumnInput({...columnInput, axialLoad: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Lado X (cm)</label>
                      <input
                        type="number" step="1"
                        value={columnInput.widthX}
                        onChange={(e) => setColumnInput({...columnInput, widthX: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Lado Y (cm)</label>
                      <input
                        type="number" step="1"
                        value={columnInput.widthY}
                        onChange={(e) => setColumnInput({...columnInput, widthY: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      />
                    </div>
                  </div>
                  
                  {/* Materiais e Detalhamento */}
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Fck (MPa)</label>
                      <select 
                        value={columnInput.fck}
                        onChange={(e) => setColumnInput({...columnInput, fck: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      >
                        <option value="20">20</option>
                        <option value="25">25</option>
                        <option value="30">30</option>
                        <option value="35">35</option>
                        <option value="40">40</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Aço Long.</label>
                      <select 
                        value={columnInput.steelType}
                        onChange={handleColumnSteelChange}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      >
                        {Object.values(SteelType).map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Barra Long. (mm)</label>
                      <select 
                        value={columnInput.longitudinalBarDiameter}
                        onChange={(e) => setColumnInput({...columnInput, longitudinalBarDiameter: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      >
                        {BAR_DIAMETERS.map(d => <option key={d} value={d}>{d}mm</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Estribo (mm)</label>
                      <select 
                        value={columnInput.stirrupDiameter}
                        onChange={(e) => setColumnInput({...columnInput, stirrupDiameter: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      >
                        {STIRRUP_DIAMETERS.map(d => <option key={d} value={d}>{d}mm</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Espaçamento Estribo (cm)</label>
                      <input
                        type="number" step="1"
                        value={columnInput.stirrupSpacing}
                        onChange={(e) => setColumnInput({...columnInput, stirrupSpacing: parseFloat(e.target.value)})}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                      />
                  </div>

                  <button type="submit" className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow transition-all transform active:scale-95">
                    Calcular Pilar
                  </button>
                </form>
              )}
              
              <div className="mt-6 flex items-start space-x-2 text-xs text-slate-400 bg-slate-50 p-3 rounded border border-slate-100">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  Esta ferramenta utiliza métodos simplificados para pré-dimensionamento. 
                  Sempre consulte um engenheiro estrutural para o projeto final executivo.
                </p>
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-7">
            {result ? (
              <>
                <ResultsCard 
                  result={result} 
                  title={activeTab === ElementType.BEAM ? "Resultados da Viga" : "Resultados do Pilar"} 
                  type={activeTab}
                  inputData={activeTab === ElementType.BEAM ? beamInput : columnInput}
                />
                
                <AIAnalysis 
                  visible={true}
                  type={activeTab}
                  inputData={activeTab === ElementType.BEAM ? beamInput : columnInput}
                  resultData={result.metrics}
                />
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-12 text-slate-400 bg-white rounded-xl border border-slate-200 border-dashed">
                <Construction className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">Aguardando cálculo</p>
                <p className="text-sm">Preencha os dados e desenhe o elemento ao lado.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;