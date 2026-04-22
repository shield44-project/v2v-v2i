/**
 * Number Plate Recognition & Vehicle Database Lookup
 * Identifies vehicles and retrieves their emission profiles
 */

export interface VehicleRecord {
  numberPlate: string;
  ownerName: string;
  vehicleType: 'two-wheeler' | 'three-wheeler' | 'car' | 'truck' | 'bus' | 'ambulance' | 'police' | 'fire';
  registrationDate: string;
  fuelType: 'petrol' | 'diesel' | 'cng' | 'lpg' | 'electric' | 'hybrid';
  engineCC: number;
  manufacturerName: string;
  modelName: string;
  color: string;
  registrationState: string;
  isEV: boolean;
  pollutionCertificateExpiry?: string;
  lastPUCDate?: string;
}

export interface PlateRecognitionResult {
  numberPlate: string;
  confidence: number; // 0-1 confidence score
  extracted: string;
  vehicleRecord?: VehicleRecord;
  extractedAt: string;
}

export interface NumberPlateOCRResult {
  text: string;
  confidence: number;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Mock vehicle database (In production, integrate with RTO API)
 * This simulates Indian RTO VAHAN database
 */
const VEHICLE_DATABASE: Record<string, VehicleRecord> = {
  'DL01AB1234': {
    numberPlate: 'DL01AB1234',
    ownerName: 'Rajesh Kumar',
    vehicleType: 'car',
    registrationDate: '2021-05-15',
    fuelType: 'petrol',
    engineCC: 1197,
    manufacturerName: 'Honda',
    modelName: 'City',
    color: 'Silver',
    registrationState: 'Delhi',
    isEV: false,
    lastPUCDate: '2025-01-15',
  },
  'MH02CD5678': {
    numberPlate: 'MH02CD5678',
    ownerName: 'Priya Sharma',
    vehicleType: 'car',
    registrationDate: '2022-08-20',
    fuelType: 'diesel',
    engineCC: 1498,
    manufacturerName: 'Maruti',
    modelName: 'Swift Dzire',
    color: 'White',
    registrationState: 'Maharashtra',
    isEV: false,
    lastPUCDate: '2025-02-10',
  },
  'KA03EF9999': {
    numberPlate: 'KA03EF9999',
    ownerName: 'Bangalore Ambulance Service',
    vehicleType: 'ambulance',
    registrationDate: '2020-12-01',
    fuelType: 'diesel',
    engineCC: 1996,
    manufacturerName: 'Mahindra',
    modelName: 'Bolero Ambulance',
    color: 'White',
    registrationState: 'Karnataka',
    isEV: false,
    pollutionCertificateExpiry: '2026-06-30',
  },
  'TN04GH2000': {
    numberPlate: 'TN04GH2000',
    ownerName: 'Chennai Police Department',
    vehicleType: 'police',
    registrationDate: '2021-03-10',
    fuelType: 'petrol',
    engineCC: 1197,
    manufacturerName: 'Maruti',
    modelName: 'Swift',
    color: 'White',
    registrationState: 'Tamil Nadu',
    isEV: false,
  },
  'EV001TESLA': {
    numberPlate: 'EV001TESLA',
    ownerName: 'Green City Rides',
    vehicleType: 'car',
    registrationDate: '2023-01-15',
    fuelType: 'electric',
    engineCC: 0,
    manufacturerName: 'Tesla',
    modelName: 'Model 3',
    color: 'Blue',
    registrationState: 'Delhi',
    isEV: true,
    pollutionCertificateExpiry: '2027-12-31',
  },
};

/**
 * Simulate OCR - In production, use Tesseract.js or cloud API
 */
export async function recognizeNumberPlateOCR(
  _imageData: string | HTMLImageElement | Canvas
): Promise<NumberPlateOCRResult> {
  // Simulate OCR processing
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        text: 'DL01AB1234',
        confidence: 0.92,
        bbox: { x: 10, y: 20, width: 150, height: 40 },
      });
    }, 500);
  });
}

/**
 * Validate number plate format (Indian standard)
 * Format: [State Code][2-Digit District][2-Letter+4-Digit]
 */
export function validateNumberPlateFormat(plate: string): boolean {
  // Indian number plate pattern
  const pattern = /^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/;
  return pattern.test(plate.toUpperCase().replace(/[^A-Z0-9]/g, ''));
}

/**
 * Clean and normalize number plate
 */
export function normalizeNumberPlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Parse Indian number plate components
 */
export function parseNumberPlate(plate: string): {
  state: string;
  district: string;
  registration: string;
  isValid: boolean;
} {
  const normalized = normalizeNumberPlate(plate);

  if (!validateNumberPlateFormat(normalized)) {
    return {
      state: '',
      district: '',
      registration: '',
      isValid: false,
    };
  }

  return {
    state: normalized.substring(0, 2),
    district: normalized.substring(2, 4),
    registration: normalized.substring(4),
    isValid: true,
  };
}

/**
 * Lookup vehicle from database by number plate
 */
export function lookupVehicleByNumberPlate(numberPlate: string): VehicleRecord | null {
  const normalized = normalizeNumberPlate(numberPlate);
  return VEHICLE_DATABASE[normalized] || null;
}

/**
 * Add or update vehicle in database (admin function)
 */
export function addVehicleToDatabase(vehicle: VehicleRecord): boolean {
  const normalized = normalizeNumberPlate(vehicle.numberPlate);

  if (!validateNumberPlateFormat(normalized)) {
    throw new Error('Invalid number plate format');
  }

  VEHICLE_DATABASE[normalized] = {
    ...vehicle,
    numberPlate: normalized,
  };

  return true;
}

/**
 * Full pipeline: Image → OCR → Normalize → Lookup
 */
export async function recognizeVehicleFromImage(
  imageData: string | HTMLImageElement | Canvas
): Promise<PlateRecognitionResult> {
  const ocrResult = await recognizeNumberPlateOCR(imageData);
  const normalized = normalizeNumberPlate(ocrResult.text);

  const vehicleRecord = lookupVehicleByNumberPlate(normalized);

  return {
    numberPlate: normalized,
    confidence: ocrResult.confidence,
    extracted: ocrResult.text,
    vehicleRecord: vehicleRecord || undefined,
    extractedAt: new Date().toISOString(),
  };
}

/**
 * Get emission profile from vehicle record
 */
export function getEmissionProfileFromVehicleRecord(record: VehicleRecord) {
  const vehicleClassMap: Record<string, 'compact' | 'sedan' | 'truck' | 'bus' | 'ambulance' | 'police' | 'micro'> = {
    'two-wheeler': 'micro',
    'three-wheeler': 'micro',
    'car': 'sedan',
    'truck': 'truck',
    'bus': 'bus',
    'ambulance': 'ambulance',
    'police': 'sedan',
    'fire': 'truck',
  };

  return {
    numberPlate: record.numberPlate,
    vehicleClass: vehicleClassMap[record.vehicleType] || 'sedan',
    fuelType: record.fuelType,
    year: new Date(record.registrationDate).getFullYear(),
    engineCc: record.engineCC,
    weight: 1200, // Default weight; should come from DB
    manufacturerName: record.manufacturerName,
    modelName: record.modelName,
    isEV: record.isEV,
  };
}

/**
 * Check if vehicle's pollution certificate is valid
 */
export function isPollutionCertificateValid(vehicle: VehicleRecord): {
  isValid: boolean;
  expiryDate?: Date;
  daysRemaining?: number;
} {
  if (!vehicle.pollutionCertificateExpiry) {
    return { isValid: false };
  }

  const expiryDate = new Date(vehicle.pollutionCertificateExpiry);
  const today = new Date();
  const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return {
    isValid: daysRemaining > 0,
    expiryDate,
    daysRemaining: Math.max(0, daysRemaining),
  };
}

/**
 * Check if PUC is due for renewal
 */
export function isPUCDueForRenewal(vehicle: VehicleRecord, renewalIntervalDays: number = 365): boolean {
  if (!vehicle.lastPUCDate) return true;

  const lastPUC = new Date(vehicle.lastPUCDate);
  const nextDueDate = new Date(lastPUC.getTime() + renewalIntervalDays * 24 * 60 * 60 * 1000);
  const today = new Date();

  return today >= nextDueDate;
}

/**
 * Generate vehicle profile card for display
 */
export function generateVehicleProfileCard(vehicle: VehicleRecord): string {
  const pollStatus = isPollutionCertificateValid(vehicle);
  const pucDue = isPUCDueForRenewal(vehicle);

  return `
    <div class="neo-card neo-card-cyan">
      <div class="p-4">
        <h3 class="text-neo-cyan font-bold text-lg">${vehicle.numberPlate}</h3>
        <p class="text-neo-text-secondary">${vehicle.manufacturerName} ${vehicle.modelName}</p>
        <p class="text-neo-text-muted text-sm">${vehicle.vehicleType.toUpperCase()} • ${vehicle.fuelType.toUpperCase()}</p>
        
        <div class="mt-4 space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-neo-text-secondary">Owner:</span>
            <span class="text-neo-text-primary">${vehicle.ownerName}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-neo-text-secondary">Pollution:</span>
            <span class="${pollStatus.isValid ? 'text-neo-success' : 'text-neo-warning'}">
              ${pollStatus.isValid ? '✓ Valid' : '✗ Expired'}
            </span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-neo-text-secondary">PUC:</span>
            <span class="${!pucDue ? 'text-neo-success' : 'text-neo-warning'}">
              ${!pucDue ? '✓ Due' : '⚠ Renewal'}
            </span>
          </div>
        </div>
      </div>
    </div>
  `;
}
