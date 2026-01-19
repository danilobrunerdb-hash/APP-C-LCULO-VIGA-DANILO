import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { BeamInput, ColumnInput, CalculationResult, ElementType } from "../types";

const captureElement = async (elementId: string, scale: number = 2): Promise<string | null> => {
    const element = document.getElementById(elementId);
    if (!element) return null;
    
    // Lista de elementos que precisamos reverter o estado
    const hiddenElements: { el: HTMLElement, cls: string }[] = [];
    
    // Percorre para cima na árvore DOM procurando pais ocultos (classe 'hidden' do Tailwind)
    let curr: HTMLElement | null = element;
    while(curr && curr.tagName !== 'BODY') {
        if(curr.classList.contains('hidden')) {
            curr.classList.remove('hidden');
            hiddenElements.push({ el: curr, cls: 'hidden' });
        }
        curr = curr.parentElement;
    }

    // Temporarily ensure background is white and no borders interfere on target element
    const originalBg = element.style.backgroundColor;
    element.style.backgroundColor = '#ffffff';

    try {
        const canvas = await html2canvas(element, {
            scale: scale,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });
        
        // Revert styles
        element.style.backgroundColor = originalBg;
        
        // Revert hidden classes
        hiddenElements.forEach(item => item.el.classList.add(item.cls));
        
        return canvas.toDataURL("image/png");
    } catch (e) {
        console.error(`Failed to capture element ${elementId}`, e);
        element.style.backgroundColor = originalBg;
        hiddenElements.forEach(item => item.el.classList.add(item.cls));
        return null;
    }
};

export const generateReport = async (
  type: ElementType,
  input: BeamInput | ColumnInput,
  result: CalculationResult
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 20;
  const rightMargin = 20;
  const contentWidth = pageWidth - leftMargin - rightMargin;
  let cursorY = 20;

  // Colors
  const COLOR_PRIMARY = [30, 41, 59]; // Slate 800
  const COLOR_SECONDARY = [71, 85, 105]; // Slate 600
  const COLOR_ACCENT = [37, 99, 235]; // Blue 600
  const COLOR_LIGHT_BG = [248, 250, 252]; // Slate 50
  const COLOR_HIGHLIGHT_BG = [241, 245, 249]; // Slate 100

  const checkPageBreak = (spaceNeeded: number = 20) => {
    if (cursorY + spaceNeeded > pageHeight - 20) {
      doc.addPage();
      cursorY = 20;
      return true;
    }
    return false;
  };

  // --- Header ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
  doc.text("Relatório de Cálculo Estrutural", leftMargin, cursorY);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2]);
  doc.text("Conforme ABNT NBR 6118:2014", pageWidth - rightMargin, cursorY, { align: "right" });
  
  cursorY += 12; 
  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(leftMargin, cursorY, pageWidth - rightMargin, cursorY);
  cursorY += 15; 

  doc.setFontSize(10);
  doc.text(`Elemento: ${type === ElementType.BEAM ? 'Viga de Concreto Armado' : 'Pilar de Concreto Armado'}`, leftMargin, cursorY);
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth - rightMargin, cursorY, { align: "right" });
  cursorY += 20; 

  // --- Section 1: Dados de Entrada ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2]);
  doc.text("1. DADOS DE ENTRADA", leftMargin, cursorY);
  cursorY += 10; 

  // Input Box Background
  doc.setFillColor(COLOR_LIGHT_BG[0], COLOR_LIGHT_BG[1], COLOR_LIGHT_BG[2]);
  doc.rect(leftMargin, cursorY, contentWidth, 35, "F");
  
  let boxY = cursorY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);

  const addInputRow = (label1: string, val1: string, label2?: string, val2?: string) => {
      doc.setFont("helvetica", "normal");
      doc.text(`${label1}:`, leftMargin + 5, boxY);
      doc.setFont("helvetica", "bold");
      doc.text(val1, leftMargin + 35, boxY);
      
      if (label2 && val2) {
          doc.setFont("helvetica", "normal");
          doc.text(`${label2}:`, leftMargin + 100, boxY);
          doc.setFont("helvetica", "bold");
          doc.text(val2, leftMargin + 130, boxY);
      }
      boxY += 8;
  };

  if ('span' in input) {
      addInputRow("Vão", `${input.span} m`, "Seção", `${input.width} x ${input.height} cm`);
      addInputRow("Concreto", `C${input.fck}`, "Aço", input.steelType);
      addInputRow("Cobrimento", `${input.concreteCover} cm`, "Estribos", `ø${input.stirrupDiameter}mm c/${input.stirrupSpacing}cm (${input.stirrupHookAngle}º)`);
  } else {
      addInputRow("Altura", `${input.height} m`, "Seção", `${input.widthX} x ${input.widthY} cm`);
      addInputRow("Carga Axial", `${input.axialLoad} kN`, "Concreto", `C${input.fck}`);
  }
  cursorY = boxY + 10;

  // --- Section 2: Esquema Estrutural ---
  if (type === ElementType.BEAM) {
      checkPageBreak(80);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2]);
      doc.text("2. ESQUEMA ESTRUTURAL", leftMargin, cursorY);
      cursorY += 10;

      const beamImg = await captureElement("beam-diagram-container");
      if (beamImg) {
          const imgProps = doc.getImageProperties(beamImg);
          const imgHeight = (contentWidth / imgProps.width) * imgProps.height;
          doc.addImage(beamImg, 'PNG', leftMargin, cursorY, contentWidth, imgHeight);
          cursorY += imgHeight + 15;
      }
  }

  // --- Section 3: Resultados Principais (Resumo) ---
  checkPageBreak(50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2]);
  doc.text(type === ElementType.BEAM ? "3. RESUMO DE RESULTADOS" : "2. RESULTADOS", leftMargin, cursorY);
  cursorY += 10;

  result.metrics.forEach(metric => {
      checkPageBreak(15);
      // Simple list style for summary
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2]);
      doc.text(`${metric.label}:`, leftMargin + 5, cursorY);
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
      doc.text(`${metric.value} ${metric.unit}`, leftMargin + 60, cursorY);
      cursorY += 7;
  });
  cursorY += 15;

  // --- Section 4: Detalhamento Gráfico ---
  checkPageBreak(120);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2]);
  doc.text("4. DETALHAMENTO GRÁFICO", leftMargin, cursorY);
  cursorY += 10;

  // Cross Section Image
  const sectionImg = await captureElement("cross-section-svg", 3);
  if (sectionImg) {
      doc.setFontSize(10);
      doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
      doc.text("Seção Transversal:", leftMargin, cursorY);
      cursorY += 7;

      const imgProps = doc.getImageProperties(sectionImg);
      const imgWidth = 80; // Smaller width for section to fit side by side or compact
      const imgHeight = (imgWidth / imgProps.width) * imgProps.height;
      
      if (checkPageBreak(imgHeight + 10)) {}
      
      // Center the section image
      const xPos = (pageWidth - imgWidth) / 2;
      doc.addImage(sectionImg, 'PNG', xPos, cursorY, imgWidth, imgHeight);
      cursorY += imgHeight + 10;
  }
  
  // Longitudinal View Image
  if (type === ElementType.BEAM) {
      checkPageBreak(80);
      const longImg = await captureElement("longitudinal-view-container", 2);
      if (longImg) {
          doc.setFontSize(10);
          doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
          doc.text("Vista Longitudinal:", leftMargin, cursorY);
          cursorY += 7;

          const imgProps = doc.getImageProperties(longImg);
          const imgHeight = (contentWidth / imgProps.width) * imgProps.height;
          
          if (checkPageBreak(imgHeight + 10)) {}

          doc.addImage(longImg, 'PNG', leftMargin, cursorY, contentWidth, imgHeight);
          cursorY += imgHeight + 15;
      }
  }

  // --- Section 5: Memorial Descritivo Detalhado ---
  checkPageBreak(50);
  doc.addPage(); 
  cursorY = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14); // Slightly bigger for main section title
  doc.setTextColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2]);
  doc.text("5. MEMORIAL DE CÁLCULO (NBR 6118)", leftMargin, cursorY);
  cursorY += 15; 

  if (result.calculationMemory && result.calculationMemory.length > 0) {
      result.calculationMemory.forEach((line) => {
          
          if (line.startsWith('#')) return; 

          let cleanLine = line.replace(/\*\*/g, '').replace(/###/g, '');
          const isHeader = line.trim().startsWith('**');
          
          // Detect special lines for styling
          const isHighlight = line.includes('CONCLUSÃO') || line.includes('STATUS') || line.includes('Detalhamento Escolhido') || line.includes('Adota-se');
          const isEquation = line.includes('=') && !isHeader && !isHighlight;
          const isNote = line.includes('OBS:');

          // Estimate height
          const fontSize = isHeader ? 11 : 10;
          doc.setFontSize(fontSize);
          
          // Width adjustment for indent
          const indent = (line.startsWith(' ') || isEquation) ? 10 : 0;
          const lineWidth = contentWidth - indent;
          
          const splitText = doc.splitTextToSize(cleanLine, lineWidth);
          const blockHeight = splitText.length * (fontSize * 0.5); // Approx spacing

          checkPageBreak(blockHeight + 4);

          if (isHeader) {
              cursorY += 5;
              doc.setFont("helvetica", "bold");
              doc.setTextColor(COLOR_ACCENT[0], COLOR_ACCENT[1], COLOR_ACCENT[2]); // Blue headers
              doc.text(cleanLine, leftMargin, cursorY);
              cursorY += 7;
          } else if (isHighlight) {
              cursorY += 2;
              doc.setFillColor(COLOR_HIGHLIGHT_BG[0], COLOR_HIGHLIGHT_BG[1], COLOR_HIGHLIGHT_BG[2]);
              doc.rect(leftMargin + indent - 2, cursorY - 4, lineWidth + 4, blockHeight + 2, "F");
              
              doc.setFont("helvetica", "bold");
              doc.setTextColor(COLOR_PRIMARY[0], COLOR_PRIMARY[1], COLOR_PRIMARY[2]);
              doc.text(splitText, leftMargin + indent, cursorY);
              cursorY += blockHeight + 3;
          } else if (isEquation) {
              doc.setFont("times", "italic"); // Serif for math
              doc.setTextColor(0, 0, 0); // Pure black
              doc.text(splitText, leftMargin + indent, cursorY);
              cursorY += blockHeight + 1.5;
          } else if (isNote) {
              doc.setFont("helvetica", "italic");
              doc.setTextColor(100, 100, 100);
              doc.text(splitText, leftMargin + indent, cursorY);
              cursorY += blockHeight + 2;
          } else {
              // Standard text
              doc.setFont("helvetica", "normal");
              doc.setTextColor(COLOR_SECONDARY[0], COLOR_SECONDARY[1], COLOR_SECONDARY[2]);
              doc.text(splitText, leftMargin + indent, cursorY);
              cursorY += blockHeight + 1.5;
          }
      });
  }

  // Footer Numbering
  const pageCount = doc.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150);
      doc.text(`CalcStruct NBR - Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: "center" });
  }

  // Save
  doc.save(`Memorial_${type}_NBR6118.pdf`);
};