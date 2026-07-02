import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize Gemini API client if key exists
let ai: GoogleGenAI | null = null;
const API_KEY = process.env.GEMINI_API_KEY;

if (API_KEY && API_KEY !== "MY_GEMINI_API_KEY") {
  try {
    ai = new GoogleGenAI({
      apiKey: API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini API client initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Gemini API client:", error);
  }
} else {
  console.log("No valid GEMINI_API_KEY found. Server will run in high-fidelity simulated AI mode.");
}

// In-Memory Database for Municipalities, Sensors, Reports and Security Teams
interface PhysicalReadings {
  acceleration: { x: number; y: number; z: number }; // m/s^2
  vibration: number; // Hz
  strain: number; // microstrain
  acoustic: number; // dB
  acousticFreq: number; // Hz
  contactOpen: boolean; // binary switch
}

interface DiscriminatingFeatures {
  peakAmplitude: number; // relative
  riseTime: number; // ms
  duration: number; // ms
  dominantFreq: number; // Hz
  rmsEnergy: number; // relative
  crestFactor: number; // peak/RMS ratio
  directionality: string; // "Omnidirectional", "Vector-Z", "Vector-X", "Vector-Y"
  crossSensorCorrelation: number; // 0.0 to 1.0 (1.0 = adjacent sensor fully triggered too)
  timeOfDay: string; // "03:15 AM", etc.
}

interface Sensor {
  id: string;
  name: string;
  type: "Power Cable" | "Railway Signal Cable" | "Water Pipeline Sensor" | "Substation Grid Line";
  municipality: string;
  latitude: number;
  longitude: number;
  status: "NORMAL" | "WARNING" | "ALERT";
  dangerScore: number; // 0-100
  lastUpdated: string;
  readings: PhysicalReadings;
  features: DiscriminatingFeatures;
  explanation?: string;
  suggestedActions?: string;
  citizenAlert?: string;
  educationalFact?: string;
}

interface CitizenReport {
  id: string;
  title: string;
  description: string;
  municipality: string;
  locationName: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  category: "Suspicious Loitering" | "Unmarked Digging" | "Open Cable Manhole" | "Vandalism in Progress" | "Sparking/Smoke";
  severity: "Low" | "Medium" | "High";
}

interface SecurityCompany {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  contact: string;
  availableVehicles: number;
  baseLocation: string;
}

// South African Security Companies in Gauteng
const securityCompanies: SecurityCompany[] = [
  { id: "sec-1", name: "Fidelity ADT Gauteng", latitude: -26.1311, longitude: 28.0515, contact: "+27 86 121 2238", availableVehicles: 8, baseLocation: "Sandton, Johannesburg" },
  { id: "sec-2", name: "Chubb Fire & Security Pretoria", latitude: -25.7564, longitude: 28.1882, contact: "+27 86 001 0022", availableVehicles: 5, baseLocation: "Pretoria Central, Tshwane" },
  { id: "sec-3", name: "RSS Security Squad", latitude: -26.0425, longitude: 28.0163, contact: "+27 86 111 4021", availableVehicles: 4, baseLocation: "Fourways, Johannesburg" },
  { id: "sec-4", name: "CSS Tactical Response", latitude: -26.1714, longitude: 28.0322, contact: "+27 11 483 3111", availableVehicles: 6, baseLocation: "Houghton, Johannesburg" },
  { id: "sec-5", name: "Vetus Schola Armed Security", latitude: -26.6500, longitude: 27.8167, contact: "+27 16 931 0122", availableVehicles: 3, baseLocation: "Vanderbijlpark, Sedibeng" },
];

// Initialise Simulated Sensors around Gauteng, South Africa
let sensors: Sensor[] = [
  {
    id: "sn-1",
    name: "Johannesburg Central Grid Sector C1",
    type: "Power Cable",
    municipality: "City of Johannesburg",
    latitude: -26.2041,
    longitude: 28.0473,
    status: "NORMAL",
    dangerScore: 12,
    lastUpdated: "Just now",
    readings: {
      acceleration: { x: 0.1, y: 0.05, z: 0.98 },
      vibration: 12,
      strain: 15,
      acoustic: 35,
      acousticFreq: 60,
      contactOpen: false
    },
    features: {
      peakAmplitude: 1.1,
      riseTime: 120,
      duration: 50,
      dominantFreq: 50,
      rmsEnergy: 0.8,
      crestFactor: 1.3,
      directionality: "Omnidirectional",
      crossSensorCorrelation: 0.1,
      timeOfDay: "03:15 AM"
    },
    explanation: "Vibration patterns within normal limits. Baseline grid frequency humming detected.",
    suggestedActions: "No dispatch required. Regular automated diagnostics are running.",
    citizenAlert: "Power grid operates normally in Johannesburg Central.",
    educationalFact: "Copper cable theft costs the South African economy over R47 billion annually, disrupting essential services like commuter rail and power grids."
  },
  {
    id: "sn-2",
    name: "Tshwane Signal Sub-station T3",
    type: "Railway Signal Cable",
    municipality: "City of Tshwane",
    latitude: -25.7479,
    longitude: 28.2293,
    status: "NORMAL",
    dangerScore: 8,
    lastUpdated: "Just now",
    readings: {
      acceleration: { x: 0.02, y: 0.01, z: 1.0 },
      vibration: 5,
      strain: 8,
      acoustic: 25,
      acousticFreq: 120,
      contactOpen: false
    },
    features: {
      peakAmplitude: 0.3,
      riseTime: 450,
      duration: 30,
      dominantFreq: 120,
      rmsEnergy: 0.2,
      crestFactor: 1.1,
      directionality: "Omnidirectional",
      crossSensorCorrelation: 0.05,
      timeOfDay: "05:45 AM"
    },
    explanation: "Signals indicate normal operating condition. Railway line has no active mechanical tension discrepancies.",
    suggestedActions: "No action required.",
    citizenAlert: "Railway signals are safe and functional near Pretoria.",
    educationalFact: "PRASA (Passenger Rail Agency of South Africa) has replaced thousands of kilometers of stolen copper cables with newly designed hybrid composite cables that contain no commercial copper value."
  },
  {
    id: "sn-3",
    name: "Ekurhuleni Grid Feed Sector E5",
    type: "Substation Grid Line",
    municipality: "City of Ekurhuleni",
    latitude: -26.2167,
    longitude: 28.1667,
    status: "WARNING",
    dangerScore: 48,
    lastUpdated: "5 mins ago",
    readings: {
      acceleration: { x: 0.8, y: 0.6, z: 1.4 },
      vibration: 85,
      strain: 120,
      acoustic: 68,
      acousticFreq: 450,
      contactOpen: false
    },
    features: {
      peakAmplitude: 3.5,
      riseTime: 25,
      duration: 180,
      dominantFreq: 400,
      rmsEnergy: 2.2,
      crestFactor: 1.8,
      directionality: "Vector-X",
      crossSensorCorrelation: 0.15,
      timeOfDay: "01:22 AM"
    },
    explanation: "Moderate vibration spikes detected along with microstrain adjustments on the primary tower frame. Acoustic signature shows metallic resonance around 400Hz.",
    suggestedActions: "Monitor closely. Pre-alert Fidelity ADT patrols near Germiston to remain vigilant.",
    citizenAlert: "Slight grid anomalies detected in Germiston area. Technical teams are performing remote checks.",
    educationalFact: "Vibration sensors are calibrated to differentiate between ambient traffic noise (low-frequency continuous vibration) and mechanical cutting/prying tools (high-frequency, repeating acoustic bursts)."
  },
  {
    id: "sn-4",
    name: "Mogale City Main Valve Pump W1",
    type: "Water Pipeline Sensor",
    municipality: "West Rand District",
    latitude: -26.1000,
    longitude: 27.7667,
    status: "NORMAL",
    dangerScore: 15,
    lastUpdated: "Just now",
    readings: {
      acceleration: { x: 0.15, y: 0.11, z: 1.02 },
      vibration: 22,
      strain: 45,
      acoustic: 48,
      acousticFreq: 180,
      contactOpen: false
    },
    features: {
      peakAmplitude: 1.5,
      riseTime: 320,
      duration: 1200,
      dominantFreq: 180,
      rmsEnergy: 1.1,
      crestFactor: 1.4,
      directionality: "Omnidirectional",
      crossSensorCorrelation: 0.35,
      timeOfDay: "11:40 AM"
    },
    explanation: "Vibration and acoustics are consistent with standard high-pressure water flow through the pipeline.",
    suggestedActions: "Regular operation. Pipeline pressure within safety standard thresholds.",
    citizenAlert: "Water pump infrastructure operates fully within parameters.",
    educationalFact: "South African water pump stations frequently suffer from electrical copper cable theft, shutting down clean water supplies for whole communities rather than just causing power blackouts."
  },
  {
    id: "sn-5",
    name: "Emfuleni Grid Feed Sub-E12",
    type: "Substation Grid Line",
    municipality: "Sedibeng District",
    latitude: -26.7000,
    longitude: 27.8333,
    status: "ALERT",
    dangerScore: 92,
    lastUpdated: "2 mins ago",
    readings: {
      acceleration: { x: 3.4, y: 2.9, z: 4.8 },
      vibration: 280,
      strain: 490,
      acoustic: 104,
      acousticFreq: 2400,
      contactOpen: true
    },
    features: {
      peakAmplitude: 12.4,
      riseTime: 4,
      duration: 3200,
      dominantFreq: 2400,
      rmsEnergy: 7.9,
      crestFactor: 3.8,
      directionality: "Vector-Z",
      crossSensorCorrelation: 0.02,
      timeOfDay: "02:45 AM"
    },
    explanation: "CRITICAL: Severe high-frequency structural vibration (280Hz) paired with a binary contacts breach (Contact Open: TRUE). Impact force estimated high, showing short, repeating heavy impact profiles. Nearby sensors remain perfectly silent, proving a localized deliberate strike.",
    suggestedActions: "IMMEDIATE DISPATCH: Send nearest armed response (Vetus Schola Security Team) to Vanderbijlpark Substation E12. Local police precinct has been auto-notified.",
    citizenAlert: "URGENT WARNING: Suspected vandalism/theft in progress at Vanderbijlpark Substation. Local residents may experience power fluctuations. Security forces are on route.",
    educationalFact: "Using sensor fusion—such as combining mechanical strain sensors (measuring physical cable tension) with electronic contact switches on metal enclosure doors—reduces false alarms caused by severe weather by 98%."
  },
  {
    id: "sn-6",
    name: "Midrand Industrial Cable Corridor M9",
    type: "Power Cable",
    municipality: "City of Johannesburg",
    latitude: -25.9983,
    longitude: 28.1262,
    status: "NORMAL",
    dangerScore: 5,
    lastUpdated: "Just now",
    readings: {
      acceleration: { x: 0.01, y: 0.01, z: 0.99 },
      vibration: 2,
      strain: 10,
      acoustic: 18,
      acousticFreq: 50,
      contactOpen: false
    },
    features: {
      peakAmplitude: 0.1,
      riseTime: 500,
      duration: 10,
      dominantFreq: 50,
      rmsEnergy: 0.1,
      crestFactor: 1.0,
      directionality: "Omnidirectional",
      crossSensorCorrelation: 0.01,
      timeOfDay: "03:45 PM"
    },
    explanation: "Silent operation. Microvibration levels are negligible.",
    suggestedActions: "No action required.",
    citizenAlert: "Midrand power corridors are operating securely.",
    educationalFact: "High-tech cable monitoring systems in South Africa now use Distributed Acoustic Sensing (DAS) which turns standard fiber optic telecommunication cables themselves into kilometers-long microphone arrays."
  },
  {
    id: "sn-7",
    name: "Soshanguve Substation Rail Feed S2",
    type: "Railway Signal Cable",
    municipality: "City of Tshwane",
    latitude: -25.5348,
    longitude: 28.1025,
    status: "WARNING",
    dangerScore: 62,
    lastUpdated: "10 mins ago",
    readings: {
      acceleration: { x: 1.2, y: 0.8, z: 1.9 },
      vibration: 110,
      strain: 240,
      acoustic: 82,
      acousticFreq: 1400,
      contactOpen: false
    },
    features: {
      peakAmplitude: 4.8,
      riseTime: 12,
      duration: 450,
      dominantFreq: 1400,
      rmsEnergy: 3.1,
      crestFactor: 2.2,
      directionality: "Vector-Y",
      crossSensorCorrelation: 0.12,
      timeOfDay: "11:55 PM"
    },
    explanation: "Multiple acoustic bursts (82dB at 1.4kHz) coinciding with moderate structural strain anomalies. The signature indicates grinding or sawing profile, but without contact cabinet breach.",
    suggestedActions: "ALERT STATUS: Dispatched Chubb Fire & Security patrol to Soshanguve Rail Corridor sector S2. Intercept report created.",
    citizenAlert: "Warning: Potential service delay warning on the Soshanguve railway feed due to a triggered infrastructure perimeter warning. Technical crews are investigating.",
    educationalFact: "Vandalism and copper theft on railway lines are classified as Sabotage and Economic Sabotage under South Africa's Criminal Matters Amendment Act, carrying prison sentences of up to 30 years."
  },
  {
    id: "sn-8",
    name: "Kempton Park Substation K4",
    type: "Substation Grid Line",
    municipality: "City of Ekurhuleni",
    latitude: -26.1012,
    longitude: 28.2314,
    status: "NORMAL",
    dangerScore: 18,
    lastUpdated: "Just now",
    readings: {
      acceleration: { x: 0.22, y: 0.18, z: 1.05 },
      vibration: 18,
      strain: 30,
      acoustic: 41,
      acousticFreq: 50,
      contactOpen: false
    },
    features: {
      peakAmplitude: 1.8,
      riseTime: 180,
      duration: 4500, // Long continuous duration like wind or a passing vehicle
      dominantFreq: 45, // Very low frequency
      rmsEnergy: 1.3,
      crestFactor: 1.4,
      directionality: "Omnidirectional",
      crossSensorCorrelation: 0.85, // Highly correlated with neighboring sensors, indicative of environmental factors (e.g., severe storm/wind)
      timeOfDay: "02:15 PM"
    },
    explanation: "Moderate low-frequency vibration. The high cross-sensor correlation (85%) with neighboring nodes strongly confirms a non-localized weather-driven event (strong wind or storm) rather than localized theft.",
    suggestedActions: "No dispatch. Confirmed environmental noise.",
    citizenAlert: "Weather-related vibration recorded at Kempton Park grid sector. No security threat identified.",
    educationalFact: "When wind storms shake overhead power cables, the movement triggers all sensors on a grid simultaneously. This high cross-correlation allows the AI to filter out storms and prevent dispatching expensive response units."
  }
];

// In-Memory Citizen Reports Database
let citizenReports: CitizenReport[] = [
  {
    id: "rep-1",
    title: "Suspicious group with ladders at night",
    description: "Saw 3 men with ladders and heavy bags walking around the transformer enclosure behind the park. They did not have municipal uniforms or vehicles.",
    municipality: "City of Ekurhuleni",
    locationName: "Kempton Park Central",
    latitude: -26.1030,
    longitude: 28.2325,
    timestamp: "2026-07-02T02:10:00Z",
    category: "Suspicious Loitering",
    severity: "High"
  },
  {
    id: "rep-2",
    title: "Open cable manhole on Main Rd",
    description: "The concrete cover of the main cable duct on Main Road seems to have been pried open and shattered. Copper cable ends are visibly exposed inside.",
    municipality: "City of Johannesburg",
    locationName: "Midrand Area",
    latitude: -25.9990,
    longitude: 28.1250,
    timestamp: "2026-07-01T15:30:00Z",
    category: "Open Cable Manhole",
    severity: "Medium"
  },
  {
    id: "rep-3",
    title: "Unmarked excavation near rail line",
    description: "There is an excavator digging trenches directly next to the signal cables near Soshanguve station. No signboards or municipal insignia are present.",
    municipality: "City of Tshwane",
    locationName: "Soshanguve North",
    latitude: -25.5340,
    longitude: 28.1010,
    timestamp: "2026-07-02T04:22:00Z",
    category: "Unmarked Digging",
    severity: "High"
  }
];

// Helper: Haversine formula to compute distance in km
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return Number(d.toFixed(2));
}

// REST API Endpoints

// Get all sensors
app.get("/api/sensors", (req, res) => {
  res.json(sensors);
});

// Update an individual sensor's physical readings (to simulate testing and triggers)
app.post("/api/sensors/:id/update", async (req, res) => {
  const { id } = req.params;
  const { readings, features } = req.body;

  const sensorIndex = sensors.findIndex(s => s.id === id);
  if (sensorIndex === -1) {
    return res.status(404).json({ error: "Sensor not found" });
  }

  // Update sensor readings & features
  sensors[sensorIndex].readings = { ...sensors[sensorIndex].readings, ...readings };
  sensors[sensorIndex].features = { ...sensors[sensorIndex].features, ...features };
  sensors[sensorIndex].lastUpdated = "Just now";

  // Recalculate basic math danger score as a first pass
  const baseDanger = calculateLocalDangerScore(sensors[sensorIndex]);
  sensors[sensorIndex].dangerScore = baseDanger;
  sensors[sensorIndex].status = baseDanger > 75 ? "ALERT" : baseDanger > 35 ? "WARNING" : "NORMAL";

  res.json({ message: "Sensor state updated", sensor: sensors[sensorIndex] });
});

// Get all security companies
app.get("/api/security-companies", (req, res) => {
  res.json(securityCompanies);
});

// Get all citizen reports
app.get("/api/reports", (req, res) => {
  res.json(citizenReports);
});

// Create a new citizen report
app.post("/api/reports", (req, res) => {
  const { title, description, municipality, locationName, latitude, longitude, category, severity } = req.body;

  if (!title || !description || !municipality || !locationName) {
    return res.status(400).json({ error: "Missing required report parameters." });
  }

  const newReport: CitizenReport = {
    id: `rep-${Date.now()}`,
    title,
    description,
    municipality,
    locationName,
    latitude: latitude || -26.2041,
    longitude: longitude || 28.0473,
    timestamp: new Date().toISOString(),
    category: category || "Suspicious Loitering",
    severity: severity || "Medium"
  };

  citizenReports.unshift(newReport);

  // Increase danger baseline for the closest sensor!
  let closestSensor: Sensor | null = null;
  let minDistance = Infinity;

  for (const s of sensors) {
    const dist = getDistanceKm(newReport.latitude, newReport.longitude, s.latitude, s.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      closestSensor = s;
    }
  }

  // If reports are within 5km, it elevates risk!
  if (closestSensor && minDistance < 10) {
    const idx = sensors.findIndex(s => s.id === closestSensor!.id);
    if (idx !== -1) {
      sensors[idx].dangerScore = Math.min(100, sensors[idx].dangerScore + (severity === "High" ? 15 : severity === "Medium" ? 10 : 5));
      sensors[idx].status = sensors[idx].dangerScore > 75 ? "ALERT" : sensors[idx].dangerScore > 35 ? "WARNING" : "NORMAL";
    }
  }

  res.json({ message: "Report submitted successfully", report: newReport });
});

// Trigger a specific preset behavior for a sensor
app.post("/api/sensors/:id/preset", async (req, res) => {
  const { id } = req.params;
  const { presetName } = req.body; // "Wind Storm", "Bird Landing", "Truck Passing", "Sledgehammer Blow", "Angle Grinder Cutting"

  const sensorIndex = sensors.findIndex(s => s.id === id);
  if (sensorIndex === -1) {
    return res.status(404).json({ error: "Sensor not found" });
  }

  const sensor = sensors[sensorIndex];
  let readings: PhysicalReadings;
  let features: DiscriminatingFeatures;

  switch (presetName) {
    case "Wind Storm":
      readings = {
        acceleration: { x: 0.35, y: 0.42, z: 1.12 },
        vibration: 28,
        strain: 52,
        acoustic: 55,
        acousticFreq: 35, // Low frequency whoosh
        contactOpen: false
      };
      features = {
        peakAmplitude: 2.1,
        riseTime: 380, // Slow onset
        duration: 8000, // Sustained
        dominantFreq: 35,
        rmsEnergy: 1.8,
        crestFactor: 1.2, // Low crest factor (continuous vibration)
        directionality: "Omnidirectional",
        crossSensorCorrelation: 0.88, // Strong cross-sensor agreement
        timeOfDay: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      };
      break;

    case "Bird Landing":
      readings = {
        acceleration: { x: 0.12, y: 0.08, z: 1.01 },
        vibration: 8,
        strain: 12,
        acoustic: 20,
        acousticFreq: 800,
        contactOpen: false
      };
      features = {
        peakAmplitude: 0.4,
        riseTime: 80,
        duration: 150, // Extremely short duration
        dominantFreq: 800,
        rmsEnergy: 0.1,
        crestFactor: 4.0, // Sharp isolated tick
        directionality: "Vector-Z",
        crossSensorCorrelation: 0.0,
        timeOfDay: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      };
      break;

    case "Truck Passing":
      readings = {
        acceleration: { x: 0.45, y: 0.38, z: 1.18 },
        vibration: 45,
        strain: 70,
        acoustic: 72,
        acousticFreq: 52, // Low frequency hum
        contactOpen: false
      };
      features = {
        peakAmplitude: 2.8,
        riseTime: 480, // Gradual rise
        duration: 5000, // Passing truck duration
        dominantFreq: 52,
        rmsEnergy: 2.1,
        crestFactor: 1.3,
        directionality: "Omnidirectional",
        crossSensorCorrelation: 0.72, // Triggered neighbor sensors along road
        timeOfDay: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      };
      break;

    case "Sledgehammer Blow":
      readings = {
        acceleration: { x: 2.9, y: 1.8, z: 4.2 },
        vibration: 180,
        strain: 320,
        acoustic: 98,
        acousticFreq: 1800,
        contactOpen: false
      };
      features = {
        peakAmplitude: 11.5,
        riseTime: 5, // Instantaneous
        duration: 400, // Short repetitive strikes
        dominantFreq: 1800, // Metal-on-metal frequencies
        rmsEnergy: 5.2,
        crestFactor: 4.8, // High crest factor
        directionality: "Vector-X",
        crossSensorCorrelation: 0.04, // Extremely localized
        timeOfDay: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      };
      break;

    case "Angle Grinder Cutting":
      readings = {
        acceleration: { x: 1.8, y: 1.5, z: 2.8 },
        vibration: 240,
        strain: 410,
        acoustic: 102,
        acousticFreq: 3200, // Screeching motor frequency
        contactOpen: true // Pried door/cabinet open too
      };
      features = {
        peakAmplitude: 8.9,
        riseTime: 12,
        duration: 9000, // Continuous grinding noise
        dominantFreq: 3200,
        rmsEnergy: 6.8,
        crestFactor: 1.6, // Low crest factor because it is continuously screaming
        directionality: "Vector-Y",
        crossSensorCorrelation: 0.01, // Completely isolated
        timeOfDay: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      };
      break;

    default:
      return res.status(400).json({ error: "Unknown preset" });
  }

  sensor.readings = readings;
  sensor.features = features;
  sensor.lastUpdated = "Just now";

  // Re-evaluate danger
  const calculatedScore = calculateLocalDangerScore(sensor);
  sensor.dangerScore = calculatedScore;
  sensor.status = calculatedScore > 75 ? "ALERT" : calculatedScore > 35 ? "WARNING" : "NORMAL";

  // Trigger Gemini or simulated analysis
  const analysisResult = await analyzeSensorStateWithAI(sensor);
  sensor.explanation = analysisResult.explanation;
  sensor.suggestedActions = analysisResult.suggestedActions;
  sensor.citizenAlert = analysisResult.citizenAlert;
  sensor.educationalFact = analysisResult.educationalFact;
  sensor.dangerScore = analysisResult.dangerScore; // Overwrite with AI calculated precision score
  sensor.status = sensor.dangerScore > 75 ? "ALERT" : sensor.dangerScore > 35 ? "WARNING" : "NORMAL";

  res.json({ message: "Preset triggered and analyzed", sensor });
});

// Run AI analysis on demand
app.post("/api/gemini/analyze", async (req, res) => {
  const { sensorId } = req.body;
  const sensor = sensors.find(s => s.id === sensorId);

  if (!sensor) {
    return res.status(404).json({ error: "Sensor not found" });
  }

  try {
    const analysisResult = await analyzeSensorStateWithAI(sensor);

    // Update in-memory state
    const idx = sensors.findIndex(s => s.id === sensorId);
    if (idx !== -1) {
      sensors[idx].explanation = analysisResult.explanation;
      sensors[idx].suggestedActions = analysisResult.suggestedActions;
      sensors[idx].citizenAlert = analysisResult.citizenAlert;
      sensors[idx].educationalFact = analysisResult.educationalFact;
      sensors[idx].dangerScore = analysisResult.dangerScore;
      sensors[idx].status = analysisResult.dangerScore > 75 ? "ALERT" : analysisResult.dangerScore > 35 ? "WARNING" : "NORMAL";
    }

    res.json({ success: true, result: analysisResult, sensor: sensors[idx] });
  } catch (error: any) {
    console.error("Error in AI analysis:", error);
    res.status(500).json({ error: "AI analysis failed", details: error.message });
  }
});

// Helper: Local fallback logic to calculate Danger Score
function calculateLocalDangerScore(sensor: Sensor): number {
  let score = 0;

  // 1. Binary contact open is a major factor (immediately adds 40 points)
  if (sensor.readings.contactOpen) {
    score += 40;
  }

  // 2. High Acoustic dB (up to 20 points)
  const db = sensor.readings.acoustic;
  if (db > 95) score += 20;
  else if (db > 75) score += 12;
  else if (db > 50) score += 5;

  // 3. High Vibration (up to 15 points)
  const vib = sensor.readings.vibration;
  if (vib > 200) score += 15;
  else if (vib > 100) score += 8;
  else if (vib > 40) score += 3;

  // 4. High Mechanical Strain (up to 15 points)
  const str = sensor.readings.strain;
  if (str > 400) score += 15;
  else if (str > 200) score += 10;
  else if (str > 80) score += 4;

  // 5. High peak acceleration (up to 15 points)
  const acc = sensor.features.peakAmplitude;
  if (acc > 10) score += 15;
  else if (acc > 5) score += 9;
  else if (acc > 2) score += 4;

  // 6. Cross-Sensor Correlation REDUCES danger score (if adjacent sensors trigger, it's environmental, e.g. storm or earthquake)
  // Highly correlated signals decrease score by up to 35 points unless cabinet binary is breached
  if (sensor.features.crossSensorCorrelation > 0.6 && !sensor.readings.contactOpen) {
    score = Math.max(5, score - 35);
  }

  // 7. Time of Day adjustments (nighttime is riskier)
  const hourStr = sensor.features.timeOfDay;
  const isNight = hourStr.includes("AM") || hourStr.startsWith("11") || hourStr.startsWith("10") || hourStr.startsWith("09");
  if (isNight) {
    score = Math.min(100, score + 10);
  }

  // Adjust citizen report proxy nearby
  const hasReports = citizenReports.some(rep => getDistanceKm(sensor.latitude, sensor.longitude, rep.latitude, rep.longitude) < 5);
  if (hasReports) {
    score = Math.min(100, score + 8);
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

// Core: Google Gemini API implementation with seamless fallback
async function analyzeSensorStateWithAI(sensor: Sensor): Promise<{
  dangerClass: string;
  dangerScore: number;
  explanation: string;
  suggestedActions: string;
  citizenAlert: string;
  educationalFact: string;
}> {
  // Extract context from nearby reports
  const relevantReports = citizenReports
    .filter(rep => getDistanceKm(sensor.latitude, sensor.longitude, rep.latitude, rep.longitude) < 8)
    .map(rep => `[Report: ${rep.category} at ${rep.locationName} - Severity: ${rep.severity}] "${rep.description}"`)
    .join("\n");

  const prompt = `
Analyze the state of a critical infrastructure sensor placed in a South African municipality to determine if theft, vandalism or economic sabotage is occurring.
This system monitors power grids, rail signal cables, and water pump systems.

SENSOR TECHNICAL METRICS:
- Name: ${sensor.name}
- Type: ${sensor.type}
- Municipality: ${sensor.municipality}
- Location coordinates: Lat ${sensor.latitude}, Lng ${sensor.longitude}
- Current Local Time: ${sensor.features.timeOfDay}

PHYSICAL READINGS:
- Acceleration (G): X=${sensor.readings.acceleration.x}, Y=${sensor.readings.acceleration.y}, Z=${sensor.readings.acceleration.z}
- Vibration Frequency: ${sensor.readings.vibration} Hz
- Mechanical Cable Strain: ${sensor.readings.strain} microstrain
- Acoustic Amplitude: ${sensor.readings.acoustic} dB
- Acoustic Dominant Frequency: ${sensor.readings.acousticFreq} Hz
- Binary Cabinet Contact Switch: ${sensor.readings.contactOpen ? "OPEN / COMPROMISED" : "CLOSED / SECURE"}

EXTRACTED WAVEFORM FEATURES:
- Waveform Peak Amplitude: ${sensor.features.peakAmplitude}
- Rise Time to Peak: ${sensor.features.riseTime} ms
- Shock/Vibration Event Duration: ${sensor.features.duration} ms
- Crest Factor (Peak/RMS ratio): ${sensor.features.crestFactor}
- Primary Directional Shock Vector: ${sensor.features.directionality}
- Cross-Sensor Node Correlation: ${sensor.features.crossSensorCorrelation} (Note: high value >0.6 suggests multiple neighboring sensors felt the same shock, typical for heavy wind, passing freight train or storm. Low values <0.1 indicate highly localized isolated impact, typical for deliberate manual theft).

NEARBY CITIZEN SUSPICIOUS REPORTS:
${relevantReports || "None recorded recently in this sector."}

Based on these parameters, evaluate if this is:
1. "CONFIRMED_BREACH" - Real active theft or cutting in progress (e.g., highly localized, high-frequency cutting sounds or sledgehammer blows, binary contacts tripped, night-time context).
2. "PROBABLE_THEFT" - Strong physical anomalies indicating active tempering or loitering (e.g. repeated impacts, moderate rise time, high-intensity noises).
3. "FALSE_TRIGGER" - Natural anomalies or non-threatening acts (e.g. strong wind storm where all sensors correlate together, passing heavy truck, a bird landing on high voltage lines, or thermal strain).
4. "LOW_SUSPICION" - Normal ambient operational noise.

Formulate an immediate threat assessment. Provide response recommendations and write a public warning message and an educational fact regarding South Africa's infrastructure crisis.
`;

  if (ai) {
    try {
      console.log(`Querying Gemini API (gemini-3.5-flash) for sensor: ${sensor.name}...`);
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are an expert infrastructure protection engineer specializing in multi-sensor fusion, acoustic classification, and security analytics for South African utilities (Eskom, Transnet, Rand Water). Determine infrastructure theft threats and output highly detailed structured analysis.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              dangerClass: {
                type: Type.STRING,
                description: "Must be exactly one of: CONFIRMED_BREACH, PROBABLE_THEFT, FALSE_TRIGGER, LOW_SUSPICION"
              },
              dangerScore: {
                type: Type.INTEGER,
                description: "An AI-calibrated risk percentage from 0 to 100 based on the sensor values, time, and citizen reports."
              },
              explanation: {
                type: Type.STRING,
                description: "A detailed engineering evaluation explaining why this classification was chosen, citing specific waveform parameters like rise-time, cross-sensor correlation and contact status."
              },
              suggestedActions: {
                type: Type.STRING,
                description: "Concrete instructions for security companies on what to do (e.g. Dispatch armed tactical team immediately, verify adjacent camera systems, flag for routine daytime maintenance, ignore false alert)."
              },
              citizenAlert: {
                type: Type.STRING,
                description: "A friendly, reassuring yet alert warning for local citizens to view on their community app, indicating what services might be disrupted and advising caution."
              },
              educationalFact: {
                type: Type.STRING,
                description: "An educational fact or legal insight regarding South African infrastructure protection (e.g., prison sentences under Criminal Matters Amendment Act, cost of copper theft, technical methods used to protect grids)."
              }
            },
            required: ["dangerClass", "dangerScore", "explanation", "suggestedActions", "citizenAlert", "educationalFact"]
          }
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        console.log(`Gemini classification succeeded: ${parsed.dangerClass} (${parsed.dangerScore}%)`);
        return parsed;
      }
    } catch (e) {
      console.error("Gemini API call failed, falling back to offline rule-based model:", e);
    }
  }

  // Safe offline rule-based fallback model
  console.log("Using high-fidelity local rule-based AI analyzer...");
  const baseScore = calculateLocalDangerScore(sensor);
  let dangerClass = "LOW_SUSPICION";
  let explanation = "";
  let suggestedActions = "";
  let citizenAlert = "";
  let educationalFact = "";

  if (baseScore > 75) {
    dangerClass = "CONFIRMED_BREACH";
    explanation = `CRITICAL DETECTED: Physical readings reveal immediate, active damage. Acoustic noise of ${sensor.readings.acoustic}dB has a high frequency spectral centroid (${sensor.readings.acousticFreq}Hz), characteristic of heavy cutting/grinding. Peak acceleration of ${sensor.features.peakAmplitude}G with an extremely rapid rise time (${sensor.features.riseTime}ms) confirms localized heavy hammer blows or cutting stress. Binary door switch is open (${sensor.readings.contactOpen}), indicating forced entry. High risk localized strictly to Sector: ${sensor.name}.`;
    suggestedActions = `IMMEDIATE RED ALERT DISPATCH: Send nearest armed response team immediately to coordinates: Lat ${sensor.latitude}, Lng ${sensor.longitude}. Auto-triangulating closest Security Base. Notify provincial tactical command center. Lock down local perimeter gates immediately.`;
    citizenAlert = `🚨 URGENT AREA WARNING: Grid infrastructure vandalism detected in ${sensor.municipality}. Tech teams and tactical security are active on site. Expect temporary localized outages. Report loitering.`;
    educationalFact = "Did you know? Under South Africa's Criminal Matters Amendment Act 24 of 2015, copper theft and vandalism are classified as heavy offences that carry a minimum of 15 years to life imprisonment with strict bail conditions.";
  } else if (baseScore > 35) {
    if (sensor.features.crossSensorCorrelation > 0.6) {
      dangerClass = "FALSE_TRIGGER";
      explanation = `FALSE ALARM (ENVIRONMENTAL): Elevated vibration and acoustical signatures detected, but the events match the baseline noise floor of an external environmental factor. Highly correlated signals (Correlation: ${Math.round(sensor.features.crossSensorCorrelation * 100)}%) across adjacent sensors confirm widespread wind pressure or heavy freight traffic rather than a localized physical breach. Cabinet contact switches remain fully locked and secure.`;
      suggestedActions = `No patrol dispatch required. Suppress alarm. Adjust rolling threshold baseline to absorb current weather peak. Flag as automated false-trigger reduction.`;
      citizenAlert = `🍃 Weather warning: Strong winds recorded near local infrastructure grids in ${sensor.municipality}. Systems remain 100% secure.`;
      educationalFact = "Modern AI-powered sensors prevent costly 'false alarm fatigue' by cross-referencing multiple grid nodes. If all sensors spike simultaneously, the system instantly flags it as a wind storm rather than an intruder.";
    } else {
      dangerClass = "PROBABLE_THEFT";
      explanation = `WARNING STATE: Highly suspicious anomalous vibrations (${sensor.readings.vibration}Hz) and microstrain stress levels detected under night-time conditions. Rise time is swift (${sensor.features.riseTime}ms) suggesting repeating manual force or drilling. Enclosure door remains secure but strain is building, suggesting a possible attempt to pry the gate or fence open.`;
      suggestedActions = `TACTICAL PATROL ALERT: Request nearest patrol squad to perform a drive-by sweep around ${sensor.name} coordinates. Access adjacent remote camera CCTV feeds for visual verification.`;
      citizenAlert = `⚠️ CITIZEN ALERT: Technical monitoring has flagged suspicious activity near infrastructure installations. Security teams are sweeping the area. Report any unmarked bakkies/vehicles.`;
      educationalFact = "Grid protection teams use piezoelectric sensors which convert mechanical deformation (vibration/impacts) directly into electric signals, detecting a hacksaw or sledgehammer before the thief can even touch the live cables.";
    }
  } else {
    dangerClass = "LOW_SUSPICION";
    explanation = "All physical quantities reside comfortably within normal, safe operational parameters. Standard grid hum (50/60Hz) is continuous and mechanical strain reflects zero structural fatigue.";
    suggestedActions = "Routine background polling. No security action required.";
    citizenAlert = "Community services are running fully secure.";
    educationalFact = "Regular monitoring keeps South Africa's lifelines running. Committing to community reporting cuts infrastructure theft times by 74%, protecting water and power grids.";
  }

  return {
    dangerClass,
    dangerScore: baseScore,
    explanation,
    suggestedActions,
    citizenAlert,
    educationalFact
  };
}

// Serve static assets in production, hook up Vite in development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production build from dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
