export enum ElementType {
  BEAM = 'Viga',
  COLUMN = 'Pilar'
}

export enum SteelType {
  CA25 = 'CA-25',
  CA50 = 'CA-50',
  CA60 = 'CA-60'
}

export enum SupportCondition {
  PINNED_PINNED = 'Bi-articulado',
  FIXED_FREE = 'Engastado-Livre',
  FIXED_PINNED = 'Engastado-Articulado',
  FIXED_FIXED = 'Bi-engastado'
}

export type SupportType = 'roller' | 'pin' | 'fixed'; // Móvel, Fixo/Rotulado, Engastado

// Diâmetros comerciais em mm
export const BAR_DIAMETERS = [6.3, 8.0, 10.0, 12.5, 16.0, 20.0, 25.0];
export const STIRRUP_DIAMETERS = [5.0, 6.3, 8.0, 10.0];

export interface PointLoad {
  id: string;
  position: number; // m
  magnitude: number; // kN
}

export interface DistributedLoad {
  id: string;
  start: number; // m
  end: number; // m
  magnitude: number; // kN/m (Deprecated in logic, kept for type safety if needed, use start/end)
  startMagnitude: number; // kN/m
  endMagnitude: number; // kN/m
}

export interface Support {
  id: string;
  position: number; // m
  type: SupportType; 
}

export interface BeamInput {
  span: number; // Comprimento total da viga em m
  supports: Support[]; // Lista de apoios
  pointLoads: PointLoad[];
  distributedLoads: DistributedLoad[];
  width: number; // cm
  height: number; // cm
  fck: number; // MPa
  steelType: SteelType;
  fyk: number; // MPa (derived)
  concreteCover: number; // cm
  longitudinalBarDiameter: number; // mm (Inferior)
  topBarDiameter: number; // mm (Superior)
  stirrupDiameter: number; // mm
  stirrupSpacing: number; // cm
  stirrupHookAngle: 90 | 135; // Graus
  layers: number; // 1, 2, or 3 (Max allowed layers)
}

export interface ColumnInput {
  height: number; // meters
  axialLoad: number; // kN
  widthX: number; // cm
  widthY: number; // cm
  fck: number; // MPa
  steelType: SteelType;
  fyk: number; // MPa (derived)
  supportCondition: SupportCondition;
  longitudinalBarDiameter: number; // mm
  stirrupDiameter: number; // mm
  stirrupSpacing: number; // cm
}

export interface CrossSectionDetails {
  width: number; // cm
  height: number; // cm
  cover: number; // cm
  stirrupDiameter: number; // mm
  stirrupSpacing: number; // cm
  stirrupHookAngle: 90 | 135;
  
  // New structure for independent layers
  bottomBarDiameter: number;
  topBarDiameter: number;
  
  // Arrays representing count of bars per layer, starting from the face inwards
  // e.g., bottomLayers[0] is the bottom-most layer
  bottomLayers: number[]; 
  topLayers: number[];
  
  // New: Side layers for Columns (intermediate bars between top and bottom corners)
  leftLayers?: number[];
  rightLayers?: number[];
  
  stirrupLegs: number;
}

export interface ReinforcementOption {
  diameter: number;
  count: number;
  area: number;
  layers: number;
  valid: boolean;
  message?: string;
}

export interface CalculationResult {
  isValid: boolean;
  messages: string[];
  calculationMemory: string[]; // Step-by-step calculation log
  metrics: {
    label: string;
    value: string | number;
    unit: string;
    description?: string;
  }[];
  chartDataMoment?: any[];
  chartDataNormal?: any[]; // For columns
  chartDataBuckling?: any[]; // New for columns (Flambagem)
  chartDataShear?: any[]; // For beams
  chartDataDeflection?: any[]; // New for beams
  crossSection?: CrossSectionDetails; // New visual data
  alternativeReinforcement?: ReinforcementOption[]; // Suggested alternatives
}

export interface AIAnalysisState {
  loading: boolean;
  content: string;
  error: string | null;
}