import { GoogleGenAI } from "@google/genai";
import { BeamInput, ColumnInput, ElementType } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeStructureWithGemini = async (
  type: ElementType,
  input: BeamInput | ColumnInput,
  calculatedMetrics: any
): Promise<string> => {
  if (!apiKey) {
    return "Erro: Chave de API não configurada. A análise da IA está indisponível.";
  }

  const modelId = "gemini-3-flash-preview";
  
  const prompt = `
    Atue como um Engenheiro Estrutural Sênior especialista na norma brasileira NBR 6118 (Projeto de estruturas de concreto - Procedimento).
    
    Analise o seguinte dimensionamento simplificado de um elemento de concreto armado:
    
    Tipo de Elemento: ${type}
    
    Dados de Entrada:
    ${JSON.stringify(input, null, 2)}
    
    Resultados Preliminares Calculados:
    ${JSON.stringify(calculatedMetrics, null, 2)}
    
    Por favor, forneça uma análise técnica concisa abordando:
    1. Verificação da sensatez dos resultados (ordem de grandeza).
    2. Comentários sobre requisitos mínimos da NBR 6118 que devem ser observados (ex: taxa mínima de armadura, dimensões mínimas, verificação de flechas/flambagem).
    3. Sugestões de otimização ou alertas de segurança.
    
    Use formatação Markdown para deixar a leitura clara. Seja direto e profissional.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });
    return response.text || "Não foi possível gerar uma análise.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Ocorreu um erro ao consultar a IA. Verifique sua conexão e chave de API.";
  }
};
