import { BeamInput, ColumnInput, CalculationResult, SupportCondition, CrossSectionDetails, BAR_DIAMETERS, ReinforcementOption, STIRRUP_DIAMETERS } from "../types";
import { solveBeam } from "./beamSolver";

// Safety factors NBR 6118
const GAMMA_C = 1.4;
const GAMMA_S = 1.15;
const GAMMA_F = 1.4;

// Tabela 17.3 NBR 6118 - Taxa mínima de armadura de flexão (%)
const getRhoMin = (fck: number): number => {
    if (fck <= 20) return 0.150;
    if (fck <= 25) return 0.150;
    if (fck <= 30) return 0.150;
    if (fck <= 35) return 0.164;
    if (fck <= 40) return 0.179;
    if (fck <= 45) return 0.194;
    if (fck <= 50) return 0.208;
    return 0.208; // Valor conservador para > 50 (não coberto por este app simplificado)
};

export const calculateBeam = (input: BeamInput): CalculationResult => {
  const { span, width, height, fck, fyk, concreteCover, longitudinalBarDiameter, topBarDiameter, stirrupDiameter, layers, stirrupSpacing, stirrupHookAngle } = input;
  
  // Stability Check First (Fail fast)
  const isCantilever = input.supports.length === 1 && input.supports[0].type === 'fixed';
  const isStable = input.supports.length >= 2 || isCantilever;

  if (!isStable) {
      return {
          isValid: false,
          messages: ["Erro: Estrutura instável (Hipostática). Adicione pelo menos 2 apoios ou 1 engaste para garantir estabilidade estática."],
          calculationMemory: ["**Cálculo Interrompido**", "A estrutura configurada é instável."],
          metrics: [],
          chartDataMoment: [],
          chartDataShear: [],
          chartDataDeflection: [],
          crossSection: undefined,
          alternativeReinforcement: []
      };
  }

  const memory: string[] = [];
  
  // Use the new solver for reactions, moments, and deflection
  const solverResult = solveBeam(input);
  const { chartDataMoment, chartDataShear, chartDataDeflection, maxMomentPos, maxMomentNeg, maxShear, maxDeflection } = solverResult;

  const V_d = maxShear * GAMMA_F;

  // Unidades de cálculo: kN, m, MPa -> convertendo para compatibilidade
  const bw = width / 100; // m
  const h = height / 100; // m
  const fcd = (fck * 1000) / GAMMA_C; // kPa
  const fyd = (fyk * 1000) / GAMMA_S; // kPa
  
  // Variáveis auxiliares para o memorial em cm/kN
  const fcd_MPa = fck / GAMMA_C;
  const fcd_kN_cm2 = fcd_MPa / 10;
  const fyd_MPa = fyk / GAMMA_S;
  const fyd_kN_cm2 = fyd_MPa / 10;
  const d_calc = height - concreteCover - (stirrupDiameter/10) - (longitudinalBarDiameter/20); // cm

  // --- 1. DIMENSÕES ESCOLHIDAS ---
  memory.push(`**1- DIMENSÕES ESCOLHIDAS:**`);
  memory.push(`   Largura (bw): ${width.toFixed(1)} cm`);
  memory.push(`   Altura (h): ${height.toFixed(1)} cm`);
  memory.push(`   Cobrimento (c): ${concreteCover.toFixed(1)} cm`);
  memory.push(`   Estribo adotado: ø${stirrupDiameter.toFixed(1)} mm`);
  memory.push(`   Barra longitudinal adotada (estimada): ø${longitudinalBarDiameter.toFixed(1)} mm`);
  memory.push(`   Altura útil (d): h - c - øest - ølong/2`);
  memory.push(`   d = ${height} - ${concreteCover} - ${stirrupDiameter/10} - ${(longitudinalBarDiameter/20).toFixed(2)} = ${d_calc.toFixed(2)} cm`);

  // --- 2. VALORES ADOTADOS PARA OS COEFICIENTES ---
  memory.push(`\n**2 - VALORES ADOTADOS PARA OS COEFICIENTES:**`);
  memory.push(`   γc (Coef. Pond. Concreto) = ${GAMMA_C} (NBR 6118 Tab. 12.1 - Normal)`);
  memory.push(`   γs (Coef. Pond. Aço) = ${GAMMA_S} (NBR 6118 Tab. 12.1 - Normal)`);
  memory.push(`   γf (Coef. Pond. Ações) = ${GAMMA_F} (Combinação Normal)`);
  memory.push(`   αc (Alpha c) = 0.85 (Para fck ≤ 50MPa, Item 17.2.2)`);
  memory.push(`   λ (Lambda) = 0.80 (Profundidade do bloco retangular, Item 17.2.2)`);
  memory.push(`   fcd (Resist. Cálculo Concreto) = fck / γc`);
  memory.push(`   fcd = ${fck} / ${GAMMA_C} = ${fcd_MPa.toFixed(2)} MPa = ${fcd_kN_cm2.toFixed(4)} kN/cm²`);
  memory.push(`   fyd (Resist. Cálculo Aço) = fyk / γs`);
  memory.push(`   fyd = ${fyk} / ${GAMMA_S} = ${fyd_MPa.toFixed(2)} MPa = ${fyd_kN_cm2.toFixed(4)} kN/cm²`);
  memory.push(`   σsd (Tensão Cálculo Aço) = fyd (Regime elástico linear até escoamento)`);
  
  let messages: string[] = [];
  let isValid = true;

  // --- ELS Check ---
  const spanCm = span * 100;
  const limitDivisor = isCantilever ? 125 : 250;
  const allowableDeflection = spanCm / limitDivisor; 
  const absMaxDeflection = Math.abs(maxDeflection); 

  if (absMaxDeflection > allowableDeflection) {
      messages.push(`Alerta ELS: Flecha calculada (${absMaxDeflection.toFixed(2)}cm) excede o limite L/${limitDivisor} (${allowableDeflection.toFixed(2)}cm).`);
  }

  // Helper to calculate reinforcement for a specific moment
  const calculateReinforcement = (MomentD_kNm: number, barDia: number, face: 'bottom' | 'top') => {
      // --- 3. DETALHAMENTO DE KC E KS ---
      memory.push(`\n**3 - DETALHAMENTO DE CÁLCULO E ÁREA DE AÇO (${face === 'bottom' ? 'VÃO/POSITIVO' : 'APOIO/NEGATIVO'})**`);
      
      const Md_kNcm = MomentD_kNm * 100;
      memory.push(`   Momento de Cálculo (Md): ${MomentD_kNm.toFixed(2)} kN.m = ${Md_kNcm.toFixed(0)} kN.cm`);

      // Recalculate d specifically for this bar choice if needed, but keeping consistent d_calc for memory clarity is better unless differ significantly
      const d_face = height - concreteCover - (stirrupDiameter/10) - (barDia/20);
      memory.push(`   Altura útil considerada (d): ${d_face.toFixed(2)} cm`);

      // Kmd Calculation (Analytical equivalent to 1/kc)
      // Kmd = Md / (bw * d^2 * fcd)
      const Kmd = Md_kNcm / (width * Math.pow(d_face, 2) * fcd_kN_cm2);
      
      memory.push(`   Cálculo de Kc (via Kmd adimensional):`);
      memory.push(`     Kmd = Md / (bw * d² * fcd)`);
      memory.push(`     Kmd = ${Md_kNcm.toFixed(0)} / (${width} * ${d_face.toFixed(2)}² * ${fcd_kN_cm2.toFixed(4)})`);
      memory.push(`     Kmd = ${Kmd.toFixed(4)}`);

      let as = 0;
      let valid = true;
      const KmdLimit = 0.45; // Domain 3/4 boundary approximation

      if (Kmd > KmdLimit) {
          valid = false;
          messages.push(`Seção insuficiente para Momento ${face === 'bottom' ? 'Positivo' : 'Negativo'} (Kmd > 0.45).`);
          memory.push(`     ALERTA: Kmd (${Kmd.toFixed(4)}) > 0.45. Domínio 4 (Ruptura frágil). Aumente a seção.`);
      } else {
          // Beta x Calculation
          // Analytical solution for rectangular block: Kmd = 0.68 * bx * (1 - 0.4*bx)
          // bx = 1.25 * (1 - sqrt(1 - 2*Kmd)) approximately for alpha_c=0.85
          const beta_x = 1.25 * (1 - Math.sqrt(1 - 2 * Kmd));
          memory.push(`   Posição da Linha Neutra (βx):`);
          memory.push(`     βx = 1.25 * (1 - √(1 - 2 * Kmd))`);
          memory.push(`     βx = ${beta_x.toFixed(4)}  (x = ${(beta_x*d_face).toFixed(2)} cm)`);

          // Beta z Calculation (Lever arm)
          const beta_z = 1 - 0.4 * beta_x;
          memory.push(`   Braço de Alavanca (βz):`);
          memory.push(`     βz = 1 - 0.4 * βx`);
          memory.push(`     βz = ${beta_z.toFixed(4)}  (z = ${(beta_z*d_face).toFixed(2)} cm)`);

          // As Calculation (Ks equivalent part)
          // As = Md / (z * fyd)
          const As_calc = Md_kNcm / ((beta_z * d_face) * fyd_kN_cm2);
          as = As_calc;
          
          memory.push(`   Cálculo da Área de Aço (As) - (Equivalente Ks):`);
          memory.push(`     As = Md / (βz * d * fyd)`);
          memory.push(`     As = ${Md_kNcm.toFixed(0)} / (${beta_z.toFixed(4)} * ${d_face.toFixed(2)} * ${fyd_kN_cm2.toFixed(4)})`);
          memory.push(`     As,calc = ${As_calc.toFixed(2)} cm²`);
      }

      // NBR 6118 Min Reinforcement Check
      const rho_min_percent = getRhoMin(fck);
      const As_min = (rho_min_percent / 100) * width * height; 
      
      memory.push(`   Verificação de Armadura Mínima:`);
      memory.push(`     ρ_min (Tabela 17.3) = ${rho_min_percent}%`);
      memory.push(`     As,min = ${rho_min_percent/100} * ${width} * ${height} = ${As_min.toFixed(2)} cm²`);

      let isConstructive = false;
      if (MomentD_kNm < 0.5) { 
          isConstructive = true;
          as = 0; 
          memory.push(`   OBS: Momento fletor muito baixo. Adotando armadura construtiva/mínima.`);
      }

      if (as < As_min) {
           as = As_min;
           memory.push(`   CONCLUSÃO AÇO: As,calc < As,min. Adota-se As = ${As_min.toFixed(2)} cm²`);
      } else {
           memory.push(`   CONCLUSÃO AÇO: As,calc ≥ As,min. Adota-se As = ${as.toFixed(2)} cm²`);
      }

      const barArea = Math.PI * Math.pow(barDia / 20, 2); 
      let numberOfBars = 0;

      if (isConstructive) {
          numberOfBars = 2; 
          if(As_min > 2 * barArea) {
              numberOfBars = Math.ceil(As_min / barArea);
              if(numberOfBars < 2) numberOfBars = 2;
          }
      } else {
          numberOfBars = Math.ceil(as / barArea);
          if (numberOfBars < 2) numberOfBars = 2;
      }
      
      const as_provided = numberOfBars * barArea;
      memory.push(`   Detalhamento Escolhido: ${numberOfBars} barras de ø${barDia}mm (As,ef = ${as_provided.toFixed(2)} cm²)`);

      // Fit Check
      const availableWidth = width - (2 * concreteCover) - (2 * stirrupDiameter / 10);
      const minSpace = Math.max(2, barDia / 10, 1.2 * 1.9); 
      const maxBarsPerLayer = Math.floor((availableWidth + minSpace) / ((barDia / 10) + minSpace));
      
      let layerCounts: number[] = [];
      let remainingBars = numberOfBars;
      let currentLayer = 0;

      while (remainingBars > 0) {
          if (currentLayer >= layers) {
              valid = false;
              messages.push(`Erro: Barras na face ${face === 'bottom' ? 'inferior' : 'superior'} não cabem em ${layers} camadas.`);
              layerCounts[currentLayer - 1] += remainingBars;
              remainingBars = 0;
          } else {
              const count = Math.min(remainingBars, maxBarsPerLayer);
              layerCounts.push(count);
              remainingBars -= count;
              currentLayer++;
          }
      }

      return {
          as_req: as,
          as_provided: as_provided,
          count: numberOfBars,
          layers: layerCounts,
          valid
      };
  };

  // Design Bottom (Positive Moment)
  const M_d_pos = Math.max(0, maxMomentPos) * GAMMA_F;
  const bottomResult = calculateReinforcement(M_d_pos, longitudinalBarDiameter, 'bottom');

  // Design Top (Negative Moment)
  const M_d_neg = Math.abs(Math.min(0, maxMomentNeg)) * GAMMA_F;
  const topBarDia = topBarDiameter || longitudinalBarDiameter;
  const topResult = calculateReinforcement(M_d_neg, topBarDia, 'top');

  if (!bottomResult.valid || !topResult.valid) isValid = false;

  // --- 4. FAZER O RESTANTE DO CÁLCULO DETALHADO ---
  memory.push(`\n**4 - CÁLCULO DETALHADO RESTANTE (CISALHAMENTO E ELS)**`);
  
  memory.push(`   Verificação ao Cisalhamento:`);
  memory.push(`     Cortante de Cálculo (Vd) = Vk * γf = ${maxShear.toFixed(2)} * ${GAMMA_F} = ${V_d.toFixed(2)} kN`);
  
  // Minimal Stirrup Ratio Check (NBR 6118 17.4.1.1)
  const fctm = 0.3 * Math.pow(fck, 2/3); // MPa
  const fywk = 500; // CA-50
  const rho_sw_min = 0.2 * (fctm / fywk); 

  // Provided Stirrup Ratio
  const Asw_leg = Math.PI * Math.pow(stirrupDiameter/20, 2); // cm2 per leg
  const Asw_total = 2 * Asw_leg; // 2 legs
  const s_cm = stirrupSpacing;
  const bw_cm = width;
  
  const rho_sw_provided = Asw_total / (s_cm * bw_cm);
  
  memory.push(`   Armadura Transversal Mínima:`);
  memory.push(`     fctm = 0.3 * ${fck}^(2/3) = ${fctm.toFixed(2)} MPa`);
  memory.push(`     ρ_sw,min = 0.2 * (fctm / fywk) = ${(rho_sw_min * 100).toFixed(3)}%`);
  memory.push(`   Armadura Transversal Fornecida:`);
  memory.push(`     Estribos: ø${stirrupDiameter}mm (2 ramos) c/${stirrupSpacing}cm`);
  memory.push(`     Asw = 2 * 3.14 * (${(stirrupDiameter/20).toFixed(2)})² = ${Asw_total.toFixed(3)} cm²`);
  memory.push(`     ρ_sw,prov = Asw / (s * bw) = ${Asw_total.toFixed(3)} / (${stirrupSpacing} * ${width}) = ${(rho_sw_provided * 100).toFixed(3)}%`);

  if (rho_sw_provided < rho_sw_min) {
      isValid = false;
      messages.push(`Erro: Taxa de estribos insuficiente. Aumente o diâmetro ou reduza o espaçamento.`);
      memory.push(`     STATUS CISALHAMENTO: REPROVADO (ρ_sw,prov < ρ_sw,min).`);
  } else {
      memory.push(`     STATUS CISALHAMENTO: OK (Atende armadura mínima).`);
  }
  
  memory.push(`   Verificação de Flecha (ELS):`);
  memory.push(`     Flecha Elástica Imediata: ${absMaxDeflection.toFixed(3)} cm`);
  memory.push(`     Limite Adotado (L/${limitDivisor}): ${allowableDeflection.toFixed(2)} cm`);
  if (absMaxDeflection > allowableDeflection) {
      memory.push(`     STATUS ELS: NÃO CONFORME. Flecha excessiva.`);
  } else {
      memory.push(`     STATUS ELS: OK.`);
  }

  const M_critical = Math.max(M_d_pos, M_d_neg);
  const alternatives: ReinforcementOption[] = [];
  
  BAR_DIAMETERS.forEach(dia => {
      if (dia < 6.3) return;
      const availableWidth = width - (2 * concreteCover) - (2 * stirrupDiameter / 10);
      const minSpace = Math.max(2, dia / 10, 1.2 * 1.9); 
      const maxBarsPerLayer = Math.floor((availableWidth + minSpace) / ((dia / 10) + minSpace));
      
      const d_est = h - 0.05; 
      const z_est = 0.9 * d_est;
      const As_est = M_critical / (z_est * fyd) * 10000;
      // Use standard As_min check for alternatives
      const rho_min_percent = getRhoMin(fck);
      const As_min_alt = (rho_min_percent / 100) * width * height;
      const As_target = Math.max(As_est, As_min_alt);

      const areaOne = Math.PI * Math.pow(dia / 20, 2);
      let count = Math.ceil(As_target / areaOne);
      if (count < 2) count = 2;

      const totalArea = count * areaOne;
      
      let layersAlt = 1;
      let validAlt = true;

      if (count <= maxBarsPerLayer) {
          layersAlt = 1;
      } else if (count <= maxBarsPerLayer * 2) {
          layersAlt = 2;
      } else if (count <= maxBarsPerLayer * 3) {
          layersAlt = 3;
      } else {
          validAlt = false;
      }

      if (validAlt && count <= 16) {
          alternatives.push({
              diameter: dia,
              count: count,
              area: totalArea,
              layers: layersAlt,
              valid: true
          });
      }
  });

  return {
    isValid,
    messages,
    calculationMemory: memory,
    metrics: [
      { label: "Momento Pos. (Md+)", value: M_d_pos.toFixed(2), unit: "kN.m", description: "Inferior" },
      { label: "Momento Neg. (Md-)", value: M_d_neg.toFixed(2), unit: "kN.m", description: "Superior" },
      { label: "Cortante (Vd)", value: V_d.toFixed(2), unit: "kN" },
      { label: "Flecha (ELS)", value: Math.abs(maxDeflection).toFixed(2), unit: "cm", description: `Limite L/${limitDivisor}: ${allowableDeflection.toFixed(2)}cm` },
      { label: "As Inf. Efetivo", value: bottomResult.as_provided.toFixed(2), unit: "cm²", description: `${bottomResult.count} ø${longitudinalBarDiameter}mm` },
      { label: "As Sup. Efetivo", value: topResult.as_provided.toFixed(2), unit: "cm²", description: `${topResult.count} ø${topBarDia}mm` }
    ],
    chartDataMoment,
    chartDataShear,
    chartDataDeflection,
    crossSection: {
      width,
      height,
      cover: concreteCover,
      stirrupDiameter,
      stirrupSpacing,
      stirrupHookAngle,
      bottomBarDiameter: longitudinalBarDiameter,
      topBarDiameter: topBarDia,
      bottomLayers: bottomResult.layers,
      topLayers: topResult.layers,
      stirrupLegs: 2
    },
    alternativeReinforcement: alternatives
  };
};

export const calculateColumn = (input: ColumnInput): CalculationResult => {
  const { height, widthX, widthY, axialLoad, fck, fyk, supportCondition, longitudinalBarDiameter, stirrupDiameter, stirrupSpacing } = input;
  
  const Nd = axialLoad * GAMMA_F; // kN
  const fcd = (fck * 1000) / GAMMA_C; // kPa -> kN/m2
  const fyd = (fyk * 1000) / GAMMA_S; // kPa -> kN/m2
  
  // Dimensions in meters
  const hx = widthX / 100; 
  const hy = widthY / 100;
  const Ac = hx * hy; // m2

  // Effective Length
  let k = 1.0;
  switch (supportCondition) {
      case SupportCondition.PINNED_PINNED: k = 1.0; break;
      case SupportCondition.FIXED_FREE: k = 2.0; break;
      case SupportCondition.FIXED_PINNED: k = 0.7; break;
      case SupportCondition.FIXED_FIXED: k = 0.5; break;
  }
  const le = k * height;

  const memory: string[] = [];
  memory.push(`**1. Dados de Entrada e Materiais**`);
  memory.push(`   Carga Axial (Nk): ${axialLoad} kN`);
  memory.push(`   Carga de Cálculo (Nd): ${Nd.toFixed(2)} kN`);
  memory.push(`   Seção: ${widthX}x${widthY} cm`);
  memory.push(`   Concreto C${fck}, Aço ${input.steelType}`);
  memory.push(`   Altura Pilar: ${height}m, Vinculação: ${supportCondition} (k=${k})`);
  
  // Slenderness Check (X and Y)
  const lambdaX = (le * 3.46) / hx;
  const lambdaY = (le * 3.46) / hy;

  memory.push(`\n**2. Esbeltez**`);
  memory.push(`   Comprimento de Flambagem (le): ${le.toFixed(2)} m`);
  memory.push(`   λx = ${lambdaX.toFixed(2)}`);
  memory.push(`   λy = ${lambdaY.toFixed(2)}`);
  
  const maxLambda = Math.max(lambdaX, lambdaY);
  if (maxLambda > 140) {
       return {
          isValid: false,
          messages: [`Esbeltez excessiva (λ=${maxLambda.toFixed(1)} > 140). Aumente a seção.`],
          calculationMemory: memory,
          metrics: [],
          alternativeReinforcement: []
      };
  }

  // Minimum Moments (1st Order) due to geometric imperfection & min eccentricity
  // e_min = 1.5 + 0.03h (cm)
  const e_min_x = 0.015 + 0.03 * hx; // m
  const e_min_y = 0.015 + 0.03 * hy; // m
  
  const M1d_min_x = Nd * e_min_x;
  const M1d_min_y = Nd * e_min_y;

  memory.push(`\n**3. Momentos Mínimos (1ª Ordem)**`);
  memory.push(`   e_min,x = ${(e_min_x*100).toFixed(2)} cm => M1d,min,x = ${M1d_min_x.toFixed(2)} kN.m`);
  memory.push(`   e_min,y = ${(e_min_y*100).toFixed(2)} cm => M1d,min,y = ${M1d_min_y.toFixed(2)} kN.m`);

  // 2nd Order Effects (Simplified Local Method)
  // NBR 6118 allows neglecting if lambda < lambda_1
  // lambda_1 = 25 ... 35. Let's use 35 as base.
  const lambda_1 = 35; 
  
  let M_tot_x = M1d_min_x;
  let M_tot_y = M1d_min_y;
  let e2_x = 0; // Displacement due to 2nd order in X dir
  let e2_y = 0; // Displacement due to 2nd order in Y dir

  const calcSecondOrder = (lambda: number, h_side: number, M1d: number) => {
      if (lambda <= lambda_1) return { Mtot: M1d, e2: 0 };
      
      // Simplified Curvature Method approximation
      const nu = Nd / (Ac * fcd);
      let curvature = 0.005 / (h_side * (nu + 0.5));
      if (curvature < 0.005/h_side) curvature = 0.005/h_side; // rough bounds
      
      const e2 = (le * le / 10) * curvature;
      return { Mtot: M1d + Nd * e2, e2 };
  };

  if (lambdaX > lambda_1) {
      const res = calcSecondOrder(lambdaX, hx, M1d_min_x);
      M_tot_x = res.Mtot;
      e2_x = res.e2;
      memory.push(`   λx > ${lambda_1}: Considerado efeitos de 2ª ordem -> M_tot,x = ${M_tot_x.toFixed(2)} kN.m`);
  }
  if (lambdaY > lambda_1) {
      const res = calcSecondOrder(lambdaY, hy, M1d_min_y);
      M_tot_y = res.Mtot;
      e2_y = res.e2;
      memory.push(`   λy > ${lambda_1}: Considerado efeitos de 2ª ordem -> M_tot,y = ${M_tot_y.toFixed(2)} kN.m`);
  }

  // Dimensioning
  // Calculate dimensionless params
  const nu = Nd / (Ac * fcd);
  
  const mu_x = M_tot_x / (hy * hx * hx * fcd); // Bending around Y axis (h=hx, b=hy)
  const mu_y = M_tot_y / (hx * hy * hy * fcd); // Bending around X axis (h=hy, b=hx).

  // Let's use a helper function simulating interaction diagram lookup for d'/h = 0.10
  const getOmega = (nu: number, mu: number) => {
      if (nu > 1.0) return 999; // Crushing
      
      // Curve fit for omega (mechanical ratio):
      // omega ~ (nu - 0.7) + 2.5 * mu (Empirical rough check)
      let w = (nu - 0.6) + 3.0 * mu; 
      if (w < 0) w = 0;
      return w;
  };
  
  const omega_x = getOmega(nu, mu_x);
  const omega_y = getOmega(nu, mu_y);
  
  const omega_req = Math.max(omega_x, omega_y);
  
  let As_calc = (omega_req * Ac * fcd) / fyd * 10000; // cm2
  
  // Minimum Reinforcement NBR 6118
  // As_min = 0.15 * Nd / fyd >= 0.004 * Ac
  const fyd_kN_cm2 = (fyk / 1.15) / 10;
  const As_min_load = 0.15 * Nd / fyd_kN_cm2;
  const As_min_geo = 0.004 * Ac * 10000; // 0.4% Ac
  
  const As_min = Math.max(As_min_load, As_min_geo);
  
  memory.push(`\n**4. Dimensionamento da Armadura**`);
  memory.push(`   Força Normal Reduzida (ν): ${nu.toFixed(3)}`);
  memory.push(`   Momento Reduzido X (μx): ${mu_x.toFixed(3)}`);
  memory.push(`   Momento Reduzido Y (μy): ${mu_y.toFixed(3)}`);
  
  let As_final = Math.max(As_calc, As_min);
  memory.push(`   As,calc (estimado): ${As_calc.toFixed(2)} cm²`);
  memory.push(`   As,min: ${As_min.toFixed(2)} cm²`);
  
  // Maximum reinforcement 4% Ac (simplified, NBR allows 8% at splices)
  const As_max = 0.04 * Ac * 10000;
  
  let isValid = true;
  let messages: string[] = [];
  
  if (nu > 1.0) {
      isValid = false;
      messages.push("Seção de concreto insuficiente (Esmagamento). Aumente as dimensões ou fck.");
  }
  
  if (As_final > As_max) {
      isValid = false;
      messages.push(`Armadura necessária (${As_final.toFixed(2)}cm²) excede o limite máximo de 4% da seção (${As_max.toFixed(2)}cm²).`);
  }

  // Detailing
  // 4 bars minimum for Rectangular
  const barArea = Math.PI * Math.pow(longitudinalBarDiameter/20, 2);
  let numBars = Math.ceil(As_final / barArea);
  if (numBars < 4) numBars = 4;
  
  // Distributed Bar Logic for Columns
  // Corners = 4 bars.
  // Remaining bars distributed along the perimeter.
  // Proportional to side lengths.
  
  const remBars = numBars - 4;
  let sideBarsVert = 0;
  let sideBarsHoriz = 0;

  if (remBars > 0) {
      const perimeterRatio = widthY / (widthX + widthY); // height / (width + height)
      let nVertTotal = Math.round(remBars * perimeterRatio);
      
      // Ensure even split for symmetry
      if (nVertTotal % 2 !== 0) nVertTotal--;
      if (nVertTotal < 0) nVertTotal = 0;
      
      let nHorizTotal = remBars - nVertTotal;
      // Ensure even split for symmetry (distribute any odd remainder to horiz or force even)
      // Since remBars might be odd if numBars is odd.
      if (nHorizTotal % 2 !== 0) {
          // Add 1 bar to meet required As (safer than removing)
          nHorizTotal++;
          numBars++; // Update total count
      }
      
      sideBarsVert = nVertTotal / 2; // Bars on Left, Bars on Right (excluding corners)
      sideBarsHoriz = nHorizTotal / 2; // Bars on Top, Bars on Bottom (excluding corners)
  }

  const As_provided = numBars * barArea;
  
  memory.push(`\n**5. Detalhamento**`);
  memory.push(`   Adotado: ${numBars} barras de ø${longitudinalBarDiameter}mm`);
  memory.push(`   Distribuição: 4 cantos + ${sideBarsHoriz*2} nas faces X + ${sideBarsVert*2} nas faces Y`);
  memory.push(`   As,efetivo: ${As_provided.toFixed(2)} cm²`);

  // --- Calc Column Cross Section Data ---
  // Default cover for columns
  const cover = 3.0;
  
  // Stirrups: NBR 6118 Check based on input
  // Input: stirrupDiameter, stirrupSpacing
  
  const minStirrupDiaRule = Math.max(5.0, longitudinalBarDiameter / 4);
  let stirrupStatus = "OK";
  if (stirrupDiameter < minStirrupDiaRule) {
      stirrupStatus = `Aviso: Diâmetro estribo (ø${stirrupDiameter}) menor que o mínimo (ø${longitudinalBarDiameter}/4 = ${minStirrupDiaRule.toFixed(1)}).`;
      messages.push(stirrupStatus);
  }
  
  const minDim = Math.min(widthX, widthY);
  const maxSpacingRule = Math.min(20, minDim, 12 * (longitudinalBarDiameter/10));
  if (stirrupSpacing > maxSpacingRule) {
      stirrupStatus = `Aviso: Espaçamento (c/${stirrupSpacing}) excede o máximo (${maxSpacingRule.toFixed(1)}cm).`;
      messages.push(stirrupStatus);
  }
  
  memory.push(`   Estribos: ø${stirrupDiameter} c/${stirrupSpacing} - ${stirrupStatus === "OK" ? "Verificado OK" : stirrupStatus}`);

  // Create Layers for visualization
  // topLayers: The top row including corners
  const topRowBars = 2 + sideBarsHoriz;
  const bottomRowBars = 2 + sideBarsHoriz;
  const leftColBars = sideBarsVert;
  const rightColBars = sideBarsVert;

  // Chart Data (Normal Force Diagram is constant)
  const chartDataNormal = [
      { x: 0, normal: Nd.toFixed(2) },
      { x: height, normal: Nd.toFixed(2) }
  ];
  
  // Moment Diagram (Linear max envelope)
  const chartDataMoment = [
      { x: 0, moment: Math.max(M_tot_x, M_tot_y).toFixed(2) },
      { x: height/2, moment: (Math.max(M_tot_x, M_tot_y)*0.6).toFixed(2) }, // Simplified shape
      { x: height, moment: Math.max(M_tot_x, M_tot_y).toFixed(2) }
  ];

  // --- Buckling Chart Data ---
  // Calculates lateral deflection profile based on Total Moment / Stiffness or Geometric Imperfection + 2nd Order
  // e_tot includes 1st order eccentricity (M/N) + e2 (from 2nd order)
  const M_design = Math.max(M_tot_x, M_tot_y);
  // Total eccentricity at critical section
  const e_tot = (M_design / Nd); // meters
  
  const chartDataBuckling = [];
  const nPoints = 20;
  for (let i = 0; i <= nPoints; i++) {
      const x = (i / nPoints) * height; // height in m
      const xi = x / height; // normalized height 0 to 1
      let shapeFactor = 0;
      
      if (supportCondition === SupportCondition.PINNED_PINNED) {
          // Mode 1: Sine half-wave
          shapeFactor = Math.sin(Math.PI * xi);
      } else if (supportCondition === SupportCondition.FIXED_FREE) {
          // Mode 2: 1/4 Cosine wave (Cantilever)
          shapeFactor = 1 - Math.cos(Math.PI * xi / 2);
      } else if (supportCondition === SupportCondition.FIXED_FIXED) {
          // Mode 3: Full Cosine shifted (Fixed-Fixed)
          // y = 0.5 * (1 - cos(2*pi*x/L))
          shapeFactor = 0.5 * (1 - Math.cos(2 * Math.PI * xi));
      } else {
          // Mode 4: Fixed-Pinned (K=0.7)
          // Polynomial approximation for visual representation: y ~ x^2 * (1-x) * asymmetric_factor
          // Fits boundary conditions: y(0)=0, y'(0)=0, y(1)=0.
          // Adjust to have max amplitude ~1 around 0.6L
          shapeFactor = (xi * xi) * (1 - xi) * 2.5; 
      }
      
      const deflectionCm = (e_tot * shapeFactor * 100).toFixed(3);
      chartDataBuckling.push({ x, deflection: deflectionCm });
  }

  return {
      isValid,
      messages,
      calculationMemory: memory,
      metrics: [
          { label: "Carga de Cálculo (Nd)", value: Nd.toFixed(2), unit: "kN" },
          { label: "Momento Total X", value: M_tot_x.toFixed(2), unit: "kN.m" },
          { label: "Momento Total Y", value: M_tot_y.toFixed(2), unit: "kN.m" },
          { label: "As Longitudinal", value: As_provided.toFixed(2), unit: "cm²", description: `${numBars} ø${longitudinalBarDiameter}mm` },
          { label: "Taxa de Armadura", value: ((As_provided/(Ac*10000))*100).toFixed(2), unit: "%" }
      ],
      chartDataNormal,
      chartDataMoment,
      chartDataBuckling,
      crossSection: {
          width: widthX,
          height: widthY,
          cover: cover,
          stirrupDiameter: stirrupDiameter,
          stirrupSpacing: stirrupSpacing,
          stirrupHookAngle: 90,
          bottomBarDiameter: longitudinalBarDiameter,
          topBarDiameter: longitudinalBarDiameter,
          bottomLayers: [bottomRowBars],
          topLayers: [topRowBars],
          leftLayers: [leftColBars],
          rightLayers: [rightColBars],
          stirrupLegs: 2
      }
  };
};