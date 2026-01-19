import React, { useState, useEffect } from 'react';
import { Bot, Sparkles, Loader2, BookOpen } from 'lucide-react';
import { ElementType } from '../types';
import { analyzeStructureWithGemini } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

interface AIAnalysisProps {
  type: ElementType;
  inputData: any;
  resultData: any;
  visible: boolean;
}

const AIAnalysis: React.FC<AIAnalysisProps> = ({ type, inputData, resultData, visible }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);

  // Reset state when inputs change
  useEffect(() => {
    setAnalysis(null);
    setHasRequested(false);
  }, [inputData, resultData]);

  if (!visible) return null;

  const handleAnalyze = async () => {
    setLoading(true);
    setHasRequested(true);
    try {
      const text = await analyzeStructureWithGemini(type, inputData, resultData);
      setAnalysis(text);
    } catch (e) {
      setAnalysis("Erro ao gerar análise. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-white p-2 rounded-lg shadow-sm">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Assistente NBR 6118</h3>
              <p className="text-sm text-slate-500">Análise técnica inteligente via Google Gemini</p>
            </div>
          </div>
          
          {!hasRequested && (
            <button
              onClick={handleAnalyze}
              className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm text-sm"
            >
              <Bot className="w-4 h-4 mr-2" />
              Analisar com IA
            </button>
          )}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm font-medium">Consultando normas técnicas...</p>
          </div>
        )}

        {analysis && (
          <div className="prose prose-indigo prose-sm max-w-none bg-white/60 p-6 rounded-xl border border-indigo-50/50">
             <div className="flex items-start gap-3 mb-4 text-indigo-900 bg-indigo-100/50 p-3 rounded-md text-xs font-semibold uppercase tracking-wider">
                <BookOpen className="w-4 h-4" />
                <span>Relatório Técnico</span>
             </div>
             {/* Simple markdown rendering */}
             <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
               {analysis.split('\n').map((line, i) => {
                 // Basic markdown parser for bold and headers since we aren't using a heavy library
                 if (line.startsWith('##')) return <h3 key={i} className="text-lg font-bold text-slate-900 mt-4 mb-2">{line.replace('##', '').trim()}</h3>;
                 if (line.startsWith('#')) return <h2 key={i} className="text-xl font-bold text-slate-900 mt-6 mb-3">{line.replace('#', '').trim()}</h2>;
                 if (line.trim().startsWith('-')) return <li key={i} className="ml-4 list-disc text-slate-700">{line.replace('-', '').trim()}</li>;
                 return <p key={i} className={line.trim() === '' ? 'h-2' : 'mb-2'}>{line}</p>;
               })}
             </div>
          </div>
        )}
        
        {!hasRequested && (
          <div className="text-center py-6 text-slate-400 text-sm">
            Clique no botão acima para verificar o dimensionamento segundo os critérios de qualidade e segurança da norma.
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAnalysis;
