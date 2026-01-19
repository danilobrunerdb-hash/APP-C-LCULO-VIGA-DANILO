import { CrossSectionDetails } from "../types";

export const generateCrossSectionDXF = (details: CrossSectionDetails): string => {
  const { 
    width, height, cover, stirrupDiameter, stirrupSpacing, stirrupHookAngle,
    bottomBarDiameter, topBarDiameter, 
    bottomLayers, topLayers 
  } = details;

  // Helper para formatar números (4 casas decimais)
  const format = (num: number) => Number(num).toFixed(4);
  
  // Helper para pares Código/Valor com quebra de linha Windows (CRLF)
  const g = (code: number, value: string | number) => `${code}\r\n${value}\r\n`;

  let dxf = "";

  // --- HEADER SECTION ---
  dxf += g(0, "SECTION");
  dxf += g(2, "HEADER");
  dxf += g(9, "$ACADVER") + g(1, "AC1009");
  dxf += g(9, "$MEASUREMENT") + g(70, 1);
  const padding = 10;
  dxf += g(9, "$EXTMIN") + g(10, -padding) + g(20, -padding) + g(30, 0.0);
  dxf += g(9, "$EXTMAX") + g(10, width + padding) + g(20, height + padding) + g(30, 0.0);
  dxf += g(0, "ENDSEC");

  // --- TABLES SECTION ---
  dxf += g(0, "SECTION");
  dxf += g(2, "TABLES");
  dxf += g(0, "TABLE");
  dxf += g(2, "LAYER");
  
  const addLayer = (name: string, color: number) => {
      let s = g(0, "LAYER");
      s += g(2, name);
      s += g(70, 0);
      s += g(62, color);
      s += g(6, "CONTINUOUS");
      return s;
  };
  
  dxf += addLayer("0", 7);
  dxf += addLayer("CONCRETO", 4); // Cyan
  dxf += addLayer("ESTRIBOS", 1); // Red
  dxf += addLayer("ARMADURA", 2); // Yellow
  dxf += addLayer("COTAS", 8);    // Gray

  dxf += g(0, "ENDTAB");
  dxf += g(0, "ENDSEC");

  // --- ENTITIES SECTION ---
  dxf += g(0, "SECTION");
  dxf += g(2, "ENTITIES");

  // --- Helpers de Desenho ---
  const drawLine = (x1: number, y1: number, x2: number, y2: number, layer: string) => {
    let s = g(0, "LINE");
    s += g(8, layer);
    s += g(10, format(x1));
    s += g(20, format(y1));
    s += g(30, 0.0);
    s += g(11, format(x2));
    s += g(21, format(y2));
    s += g(31, 0.0);
    return s;
  };

  const drawCircle = (cx: number, cy: number, r: number, layer: string) => {
    let s = g(0, "CIRCLE");
    s += g(8, layer);
    s += g(10, format(cx));
    s += g(20, format(cy));
    s += g(30, 0.0);
    s += g(40, format(r));
    return s;
  };

  const drawRect = (x: number, y: number, w: number, h: number, layer: string) => {
    let s = g(0, "POLYLINE");
    s += g(8, layer);
    s += g(66, 1);
    s += g(10, 0.0) + g(20, 0.0) + g(30, 0.0);
    s += g(70, 1);
    
    const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    pts.forEach(p => {
        s += g(0, "VERTEX");
        s += g(8, layer);
        s += g(10, format(p[0]));
        s += g(20, format(p[1]));
        s += g(30, 0.0);
    });
    
    s += g(0, "SEQEND");
    s += g(8, layer);
    return s;
  };

  const drawText = (x: number, y: number, height: number, text: string, layer: string, rotation: number = 0, align: 'left' | 'center' | 'right' = 'left') => {
      let s = g(0, "TEXT");
      s += g(8, layer);
      s += g(10, format(x));
      s += g(20, format(y));
      s += g(30, 0.0);
      s += g(40, format(height));
      s += g(1, text);
      s += g(50, format(rotation));

      let halign = 0;
      if (align === 'center') halign = 1;
      if (align === 'right') halign = 2;

      if (halign !== 0) {
          s += g(72, halign); 
          s += g(11, format(x));
          s += g(21, format(y));
          s += g(31, 0.0);
      }
      return s;
  }

  // --- GEOMETRIA ---

  // 1. Concreto
  dxf += drawRect(0, 0, width, height, "CONCRETO");

  // 2. Estribos
  const stirrupDiaCm = stirrupDiameter / 10;
  const sOffset = cover + stirrupDiaCm/2; 
  const sW = width - 2 * sOffset;
  const sH = height - 2 * sOffset;
  
  // Dimensões Úteis do Estribo (Face a Face externa do aço)
  const estriboW = width - 2 * cover;
  const estriboH = height - 2 * cover;
  
  // Calculo Gancho NBR
  // NBR 6118 18.2.4: Gancho 135 (seismico) >= 5phi ou 5cm
  // Gancho 90 >= 8phi ou 7cm (prática comum, norma pede ancoragem)
  let hookLenCm = 0;
  if (stirrupHookAngle === 135) {
      hookLenCm = Math.max(5 * stirrupDiaCm, 5.0);
  } else {
      hookLenCm = Math.max(8 * stirrupDiaCm, 7.0); 
  }
  
  dxf += drawRect(sOffset, sOffset, sW, sH, "ESTRIBOS");

  // 3. Barras Longitudinais
  const stirrupInternalLeft = cover + stirrupDiaCm;

  const drawBarLayer = (count: number, layerIdx: number, isTop: boolean) => {
      const barDiaCm = isTop ? topBarDiameter / 10 : bottomBarDiameter / 10;
      const radius = barDiaCm / 2;
      const layerSpacing = Math.max(2.0, barDiaCm);
      
      let yPos = 0;
      if (isTop) {
          yPos = height - (stirrupInternalLeft + radius + (layerIdx * (layerSpacing + barDiaCm)));
      } else {
          yPos = stirrupInternalLeft + radius + (layerIdx * (layerSpacing + barDiaCm));
      }

      const startX = stirrupInternalLeft + radius;
      const endX = width - stirrupInternalLeft - radius;
      const availableW = endX - startX;

      if (count === 1) {
          dxf += drawCircle(width / 2, yPos, radius, "ARMADURA");
      } else {
          const step = availableW / (count - 1);
          for (let i = 0; i < count; i++) {
              const cx = startX + (i * step);
              dxf += drawCircle(cx, yPos, radius, "ARMADURA");
          }
      }
  };

  bottomLayers.forEach((count, idx) => drawBarLayer(count, idx, false));
  topLayers.forEach((count, idx) => drawBarLayer(count, idx, true));

  // 4. Cotas
  const dimDist = 5;
  const tickSize = 1;
  const tSize = 2.5;

  // Largura Concreto
  const yDimBot = -dimDist;
  dxf += drawLine(0, yDimBot, width, yDimBot, "COTAS");
  dxf += drawLine(0, yDimBot+tickSize, 0, yDimBot-tickSize, "COTAS");
  dxf += drawLine(width, yDimBot+tickSize, width, yDimBot-tickSize, "COTAS");
  dxf += drawText(width/2, yDimBot - tickSize - 1, tSize, `${width} cm`, "COTAS", 0, 'center');

  // Altura Concreto
  const xDimLeft = -dimDist;
  dxf += drawLine(xDimLeft, 0, xDimLeft, height, "COTAS");
  dxf += drawLine(xDimLeft-tickSize, 0, xDimLeft+tickSize, 0, "COTAS");
  dxf += drawLine(xDimLeft-tickSize, height, xDimLeft+tickSize, height, "COTAS");
  dxf += drawText(xDimLeft - tickSize - 1, height/2, tSize, `${height} cm`, "COTAS", 90, 'center');

  // Textos de Detalhamento
  const labelY = height + 5;
  const sSpacingTxt = stirrupSpacing ? stirrupSpacing : "??";
  
  // Informação Detalhada Estribo
  dxf += drawText(width/2, labelY, 1.5, `Estribos %%C${stirrupDiameter}mm c/${sSpacingTxt}cm`, "COTAS", 0, 'center');
  dxf += drawText(width/2, labelY - 2.0, 1.2, `Dim. Estribo: ${estriboW.toFixed(1)} x ${estriboH.toFixed(1)} cm`, "COTAS", 0, 'center');
  dxf += drawText(width/2, labelY - 3.5, 1.2, `Dobra (Gancho): ${hookLenCm.toFixed(1)} cm (${stirrupHookAngle}%%d)`, "COTAS", 0, 'center');

  const topBarsCount = topLayers.reduce((a, b) => a + b, 0);
  dxf += drawText(width/2, labelY + 3, 1.5, `${topBarsCount} %%C${topBarDiameter}mm (SUP)`, "COTAS", 0, 'center');

  const botBarsCount = bottomLayers.reduce((a,b)=>a+b,0);
  dxf += drawText(width/2, -dimDist - 7, 1.5, `${botBarsCount} %%C${bottomBarDiameter}mm (INF)`, "COTAS", 0, 'center');

  dxf += g(0, "ENDSEC");
  dxf += g(0, "EOF");

  return dxf;
};