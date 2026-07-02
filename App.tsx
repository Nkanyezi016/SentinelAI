import React, { useState, useEffect } from "react";
import { 
  Building2, 
  ShieldAlert, 
  Users, 
  AlertTriangle, 
  Activity, 
  MapPin, 
  Phone, 
  FileText, 
  RefreshCw, 
  Info, 
  Play, 
  CheckCircle2, 
  Compass, 
  Flame, 
  Zap, 
  Radio, 
  PlusCircle, 
  HelpCircle,
  Clock,
  Navigation,
  Sparkles,
  Gauge,
  Lock,
  Unlock,
  BookOpen
} from "lucide-react";

// Sensor Interfaces
interface PhysicalReadings {
  acceleration: { x: number; y: number; z: number };
  vibration: number;
  strain: number;
  acoustic: number;
  acousticFreq: number;
  contactOpen: boolean;
}

interface DiscriminatingFeatures {
  peakAmplitude: number;
  riseTime: number;
  duration: number;
  dominantFreq: number;
  rmsEnergy: number;
  crestFactor: number;
  directionality: string;
  crossSensorCorrelation: number;
  timeOfDay: string;
}

interface Sensor {
  id: string;
  name: string;
  type: "Power Cable" | "Railway Signal Cable" | "Water Pipeline Sensor" | "Substation Grid Line";
  municipality: string;
  latitude: number;
  longitude: number;
  status: "NORMAL" | "WARNING" | "ALERT";
  dangerScore: number;
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
  distance?: number; // Calculated dynamically client-side
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"government" | "security" | "citizen">("government");
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [securityCompanies, setSecurityCompanies] = useState<SecurityCompany[]>([]);
  const [selectedSensor, setSelectedSensor] = useState<Sensor | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [analyzingSensorId, setAnalyzingSensorId] = useState<string | null>(null);
  
  // Selected Security Company ID for security company operator dashboard view
  const [selectedSecurityCompanyId, setSelectedSecurityCompanyId] = useState<string>("sec-1");

  // Dispatch units tracking
  const [dispatchedUnits, setDispatchedUnits] = useState<{ [sensorId: string]: string }>({});

  // Citizen report state form
  const [reportTitle, setReportTitle] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [reportCategory, setReportCategory] = useState<"Suspicious Loitering" | "Unmarked Digging" | "Open Cable Manhole" | "Vandalism in Progress" | "Sparking/Smoke">("Suspicious Loitering");
  const [reportSeverity, setReportSeverity] = useState<"Low" | "Medium" | "High">("Medium");
  const [reportMunicipality, setReportMunicipality] = useState("City of Johannesburg");
  const [reportLocation, setReportLocation] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Fetch initial data - supports silent loading to prevent flashing loading screens
  const fetchData = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      }
      const [sensorsRes, reportsRes, securityRes] = await Promise.all([
        fetch("/api/sensors"),
        fetch("/api/reports"),
        fetch("/api/security-companies")
      ]);
      const sensorsData = await sensorsRes.json();
      const reportsData = await reportsRes.json();
      const securityData = await securityRes.json();

      setSensors(sensorsData);
      setReports(reportsData);
      setSecurityCompanies(securityData);

      // Default selected sensor
      if (sensorsData.length > 0 && !selectedSensor) {
        setSelectedSensor(sensorsData[0]);
      } else if (selectedSensor) {
        const updated = sensorsData.find((s: Sensor) => s.id === selectedSensor.id);
        if (updated) setSelectedSensor(updated);
      }
    } catch (e) {
      console.error("Error fetching data:", e);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData(true);
    // Poll every 8 seconds SILENTLY to reflect simulation changes in other views
    const interval = setInterval(() => fetchData(false), 8000);
    return () => clearInterval(interval);
  }, []);

  // Calculate dynamic Factor Points for Gauteng municipalities based on live sensor telemetry and citizen intel
  const calculateMunicipalityFactorPoints = (muniName: string) => {
    let totalPoints = 0;
    
    // 1. Filter sensors of this municipality
    const muniSensors = sensors.filter(s => s.municipality === muniName);
    // 2. Filter reports of this municipality
    const muniReports = reports.filter(r => r.municipality === muniName);
    
    // 3. Accumulate points from sensors
    muniSensors.forEach(s => {
      // Vibration contributions (up to 30 points)
      if (s.readings.vibration > 150) totalPoints += 25;
      else if (s.readings.vibration > 50) totalPoints += 12;
      
      // Strain contributions (up to 25 points)
      if (s.readings.strain > 300) totalPoints += 20;
      else if (s.readings.strain > 100) totalPoints += 10;
      
      // Acoustic levels (up to 20 points)
      if (s.readings.acoustic > 90) totalPoints += 15;
      else if (s.readings.acoustic > 60) totalPoints += 8;
      
      // Cabinet open door breach (extreme sabotage risk)
      if (s.readings.contactOpen) totalPoints += 45;
      
      // Alarm status severity weighting
      if (s.status === "ALERT") totalPoints += 30;
      else if (s.status === "WARNING") totalPoints += 15;
    });
    
    // 4. Accumulate points from citizen reports
    muniReports.forEach(r => {
      if (r.severity === "High") totalPoints += 20;
      else if (r.severity === "Medium") totalPoints += 10;
      else totalPoints += 5;
    });
    
    return totalPoints || 5; // minimum floor baseline of 5 points for any populated area
  };

  // Helper: Haversine distance
  function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
  }

  // Trigger preset scenario
  const handleTriggerPreset = async (sensorId: string, presetName: string) => {
    try {
      setAnalyzingSensorId(sensorId);
      const res = await fetch(`/api/sensors/${sensorId}/preset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetName })
      });
      const data = await res.json();
      if (data.sensor) {
        // Update state
        setSensors(prev => prev.map(s => s.id === sensorId ? data.sensor : s));
        setSelectedSensor(data.sensor);
      }
    } catch (error) {
      console.error("Error triggering preset:", error);
    } finally {
      setAnalyzingSensorId(null);
    }
  };

  // Run Gemini analysis on demand
  const handleRunAIAnalysis = async (sensorId: string) => {
    try {
      setAnalyzingSensorId(sensorId);
      const res = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sensorId })
      });
      const data = await res.json();
      if (data.success && data.sensor) {
        setSensors(prev => prev.map(s => s.id === sensorId ? data.sensor : s));
        setSelectedSensor(data.sensor);
      }
    } catch (error) {
      console.error("Error analyzing with AI:", error);
    } finally {
      setAnalyzingSensorId(null);
    }
  };

  // Submit citizen report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle || !reportDesc || !reportLocation) return;

    try {
      setIsSubmittingReport(true);
      // Give it slightly randomized coordinates near Johannesburg/Tshwane
      let lat = -26.2041;
      let lng = 28.0473;
      if (reportMunicipality === "City of Tshwane") {
        lat = -25.7479 + (Math.random() - 0.5) * 0.1;
        lng = 28.2293 + (Math.random() - 0.5) * 0.1;
      } else if (reportMunicipality === "City of Ekurhuleni") {
        lat = -26.2167 + (Math.random() - 0.5) * 0.1;
        lng = 28.1667 + (Math.random() - 0.5) * 0.1;
      } else if (reportMunicipality === "West Rand District") {
        lat = -26.1000 + (Math.random() - 0.5) * 0.1;
        lng = 27.7667 + (Math.random() - 0.5) * 0.1;
      } else if (reportMunicipality === "Sedibeng District") {
        lat = -26.7000 + (Math.random() - 0.5) * 0.1;
        lng = 27.8333 + (Math.random() - 0.5) * 0.1;
      } else {
        lat = -26.2041 + (Math.random() - 0.5) * 0.1;
        lng = 28.0473 + (Math.random() - 0.5) * 0.1;
      }

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: reportTitle,
          description: reportDesc,
          municipality: reportMunicipality,
          locationName: reportLocation,
          latitude: lat,
          longitude: lng,
          category: reportCategory,
          severity: reportSeverity
        })
      });

      if (res.ok) {
        setReportSuccess(true);
        setReportTitle("");
        setReportDesc("");
        setReportLocation("");
        // Refresh
        fetchData();
        setTimeout(() => setReportSuccess(false), 5000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Helper: get danger color
  const getDangerColor = (score: number) => {
    if (score > 75) return "bg-rose-600 text-white border-rose-500 shadow-rose-950/30";
    if (score > 35) return "bg-amber-500 text-slate-900 border-amber-400 shadow-amber-950/20";
    return "bg-emerald-600 text-white border-emerald-500 shadow-emerald-950/20";
  };

  const getDangerBarColor = (score: number) => {
    if (score > 75) return "bg-rose-600 shadow-[0_0_12px_rgba(225,29,72,0.6)]";
    if (score > 35) return "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]";
    return "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]";
  };

  const getDangerTextColor = (score: number) => {
    if (score > 75) return "text-rose-400";
    if (score > 35) return "text-amber-400";
    return "text-emerald-400";
  };

  const getStatusBadgeClass = (status: "NORMAL" | "WARNING" | "ALERT") => {
    if (status === "ALERT") return "bg-rose-950/40 text-rose-400 border border-rose-500/50 animate-pulse";
    if (status === "WARNING") return "bg-amber-950/40 text-amber-400 border border-amber-500/50";
    return "bg-emerald-950/40 text-emerald-400 border border-emerald-500/40";
  };

  // Province-wide stats
  const totalAlerts = sensors.filter(s => s.status === "ALERT").length;
  const totalWarnings = sensors.filter(s => s.status === "WARNING").length;
  const activeSecurityCount = securityCompanies.length;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans antialiased selection:bg-slate-700 selection:text-white">
      {/* Dynamic Upper Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[120px] bg-gradient-to-b from-blue-500/5 via-transparent to-transparent blur-3xl pointer-events-none" />

      {/* Header Banner */}
      <header className="border-b border-slate-800/60 bg-[#0e1424]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-950/20">
                <ShieldAlert className="w-6 h-6 text-slate-950 stroke-[2]" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border border-slate-950 animate-ping" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border border-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
                  SentinelAI
                </h1>
                <span className="text-[10px] uppercase tracking-wider font-mono bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
                  Province Hub
                </span>
              </div>
              <p className="text-xs text-slate-400">South African Infrastructure Protection Network (Gauteng)</p>
            </div>
          </div>

          {/* Core App Swapper Tab Bar */}
          <div className="flex bg-slate-900/90 border border-slate-800/80 rounded-xl p-1 gap-1 w-full sm:w-auto">
            <button
              id="btn-nav-gov"
              onClick={() => setActiveTab("government")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                activeTab === "government"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-950/50"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Government Command</span>
            </button>
            <button
              id="btn-nav-sec"
              onClick={() => setActiveTab("security")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                activeTab === "security"
                  ? "bg-gradient-to-r from-rose-600 to-orange-600 text-white shadow-md shadow-rose-950/50"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Security Tactical</span>
            </button>
            <button
              id="btn-nav-cit"
              onClick={() => setActiveTab("citizen")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                activeTab === "citizen"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950/50"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Citizen Portal</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Stats Ribbon */}
      <section className="bg-[#0c1220] border-b border-slate-900 px-4 py-3 text-slate-300">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-semibold text-slate-400">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              SYSTEM ACTIVE:
            </span>
            <span className="font-mono text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              8 Sensors reporting
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
              <span className="text-rose-400 font-semibold">{totalAlerts} Critical Breaches</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-amber-400 font-semibold">{totalWarnings} Warnings</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-emerald-400 font-semibold">{activeSecurityCount} Armed Patrol Bases On Line</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
            <p className="text-sm text-slate-400 font-mono">Syncing provincial telemetry feed...</p>
          </div>
        )}

        {!loading && (
          <div>
            {/* TAB 1: GOVERNMENT INTERFACE */}
            {activeTab === "government" && (
              <div className="space-y-6">
                
                {/* TOP BENTO ROW: Geographic Map & Municipality Factor Scoreboard (Satisfying 'maps on top, not grids' & 'Gauteng factors') */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Gauteng Provincial GIS Grid Map (cols: 8) */}
                  <div className="lg:col-span-8 bg-[#0e1424] border border-slate-800/80 rounded-2xl p-4 shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Compass className="w-4 h-4 text-indigo-400" />
                        <h2 className="font-display font-bold text-sm">Gauteng Provincial GIS Grid</h2>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        Visualizing coordinates & alert boundaries
                      </span>
                    </div>

                    {/* SVG Vector Map of Gauteng Province */}
                    <div className="relative w-full h-[280px] bg-slate-950 rounded-xl overflow-hidden border border-slate-900 flex items-center justify-center">
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:24px_24px] opacity-40" />
                      
                      {/* Gauteng Boundaries Drawing */}
                      <svg viewBox="0 0 800 500" className="w-full h-full p-4 opacity-75">
                        {/* City of Tshwane (North) */}
                        <path d="M 150,50 L 650,50 L 550,220 L 250,220 Z" fill="#1e293b" fillOpacity="0.2" stroke="#475569" strokeWidth="1.5" strokeDasharray="3,3" />
                        <text x="350" y="110" fill="#64748b" fontSize="14" fontWeight="bold" fontFamily="monospace">CITY OF TSHWANE</text>

                        {/* City of Johannesburg (Central West) */}
                        <path d="M 220,220 L 400,220 L 380,380 L 150,380 Z" fill="#1e293b" fillOpacity="0.2" stroke="#475569" strokeWidth="1.5" strokeDasharray="3,3" />
                        <text x="210" y="300" fill="#64748b" fontSize="14" fontWeight="bold" fontFamily="monospace">CITY OF JOBURG</text>

                        {/* City of Ekurhuleni (East) */}
                        <path d="M 400,220 L 680,220 L 620,380 L 380,380 Z" fill="#1e293b" fillOpacity="0.2" stroke="#475569" strokeWidth="1.5" strokeDasharray="3,3" />
                        <text x="440" y="290" fill="#64748b" fontSize="14" fontWeight="bold" fontFamily="monospace">EKURHULENI (EAST)</text>

                        {/* West Rand (West) */}
                        <path d="M 50,150 L 220,220 L 150,380 L 50,380 Z" fill="#1e293b" fillOpacity="0.1" stroke="#475569" strokeWidth="1" strokeDasharray="4,4" />
                        <text x="80" y="220" fill="#475569" fontSize="10" fontWeight="bold" fontFamily="monospace">WEST RAND</text>

                        {/* Sedibeng / Emfuleni (South) */}
                        <path d="M 150,380 L 620,380 L 500,480 L 250,480 Z" fill="#1e293b" fillOpacity="0.1" stroke="#475569" strokeWidth="1" strokeDasharray="4,4" />
                        <text x="340" y="440" fill="#475569" fontSize="10" fontWeight="bold" fontFamily="monospace">SEDIBENG / EMFULENI</text>
                      </svg>

                      {/* Map Coordinate Indicators Overlay */}
                      {sensors.map((sensor) => {
                        const x = ((sensor.longitude - 27.4) / (28.6 - 27.4)) * 100;
                        const y = ((sensor.latitude - -25.4) / (-27.0 - -25.4)) * 100;

                        const isSelected = selectedSensor?.id === sensor.id;
                        const markerColor = sensor.status === "ALERT" 
                          ? "bg-rose-600 ring-rose-500 animate-bounce" 
                          : sensor.status === "WARNING" 
                          ? "bg-amber-500 ring-amber-400" 
                          : "bg-emerald-500 ring-emerald-400";

                        return (
                          <button
                            key={sensor.id}
                            onClick={() => setSelectedSensor(sensor)}
                            className={`absolute -translate-x-1/2 -translate-y-1/2 group transition-all duration-300 ${isSelected ? "z-20 scale-125" : "z-10"}`}
                            style={{ left: `${x}%`, top: `${y}%` }}
                          >
                            <span className="relative flex h-5 w-5 items-center justify-center">
                              {sensor.status === "ALERT" && (
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                              )}
                              <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${markerColor} ring-4 ring-slate-950 border border-white/25`} />
                            </span>
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-[10px] text-white px-2 py-1 rounded border border-slate-800 whitespace-nowrap z-30 shadow-xl">
                              <span className="font-bold block">{sensor.name}</span>
                              <span className="text-slate-400">Risk: {sensor.dangerScore}% ({sensor.status})</span>
                            </div>
                          </button>
                        );
                      })}
                      
                      {/* Map Legend */}
                      <div className="absolute bottom-3 left-3 bg-slate-900/95 border border-slate-800 px-3 py-2 rounded-lg text-[9px] font-mono flex gap-4 z-10 shadow-lg">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-600" />
                          <span>Critical Alarm (&gt;75%)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>Warning (35%-75%)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Normal</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Gauteng Province Municipality Risk Index factor points (cols: 4) */}
                  <div className="lg:col-span-4 bg-[#0e1424] border border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-indigo-400" />
                          <h2 className="font-display font-bold text-sm tracking-tight">Municipality Threat Factors</h2>
                        </div>
                        <span className="text-[9px] text-indigo-400 font-mono">GAUTENG</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">Risk factor points aggregate physical sensor drift, mechanical tension stress, and community intel reports:</p>
                      
                      <div className="space-y-2.5">
                        {[
                          { name: "City of Johannesburg", tag: "JOBURG", color: "from-indigo-600 to-blue-500" },
                          { name: "City of Tshwane", tag: "TSHWANE", color: "from-amber-500 to-orange-500" },
                          { name: "City of Ekurhuleni", tag: "EKURHULENI", color: "from-purple-600 to-pink-500" },
                          { name: "West Rand District", tag: "WEST RAND", color: "from-emerald-600 to-teal-500" },
                          { name: "Sedibeng District", tag: "SEDIBENG", color: "from-rose-600 to-red-500" }
                        ].map(muni => {
                          const pts = calculateMunicipalityFactorPoints(muni.name);
                          // Determine color/status for factor bar
                          const scoreColor = pts > 80 ? "text-rose-400" : pts > 30 ? "text-amber-400" : "text-emerald-400";
                          const progressPercent = Math.min(100, (pts / 150) * 100);

                          return (
                            <div key={muni.name} className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-900/60">
                              <div className="flex justify-between items-center text-xs mb-1">
                                <span className="font-semibold text-slate-300">{muni.name}</span>
                                <span className={`font-mono font-bold text-xs ${scoreColor}`}>{pts} pts</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-900/90 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full bg-gradient-to-r ${muni.color} rounded-full transition-all duration-500`}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/60 text-[9px] text-slate-500 font-mono leading-relaxed">
                      * Cabinet Open = 45pts | Sensor Alarm = 30pts | High Vibration = 25pts | Strain = 20pts | Citizen Intel = 10-20pts. Over 80pts triggers direct escalation.
                    </div>
                  </div>

                </div>

                {/* BOTTOM ROW: Active Grid Feed sidebar (cols: 4) & Diagnostic Detail Panel (cols: 8) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column: Active Grid Feed & Citizen Intel Stream (cols: 4) */}
                  <div className="lg:col-span-4 flex flex-col gap-4">
                    
                    {/* Active Grid Feed List */}
                    <div className="bg-[#0e1424] border border-slate-800/80 rounded-2xl p-4 shadow-xl">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Radio className="w-4 h-4 text-indigo-400" />
                          <h2 className="font-display font-bold text-sm tracking-tight">Active Grid Feed</h2>
                        </div>
                        <span className="text-[10px] text-indigo-400 font-mono">LIVE CLASSIFY</span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">Click any sensor node to load physical waveform diagnostics & AI analytics.</p>

                      <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                        {sensors.map((sensor) => {
                          const isSelected = selectedSensor?.id === sensor.id;
                          return (
                            <div
                              id={`sensor-card-${sensor.id}`}
                              key={sensor.id}
                              onClick={() => setSelectedSensor(sensor)}
                              className={`group border rounded-xl p-3 cursor-pointer transition-all duration-200 ${
                                isSelected 
                                  ? "bg-slate-900 border-indigo-500/80 shadow-lg shadow-indigo-950/20" 
                                  : "bg-[#111827]/40 border-slate-800/60 hover:border-slate-700/80 hover:bg-slate-900/40"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <h3 className="text-xs font-semibold text-slate-200 group-hover:text-indigo-400 transition-colors">
                                    {sensor.name}
                                  </h3>
                                  <span className="text-[10px] text-slate-500 font-mono block">
                                    {sensor.municipality} • {sensor.type}
                                  </span>
                                </div>
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${getStatusBadgeClass(sensor.status)}`}>
                                  {sensor.status}
                                </span>
                              </div>

                              <div className="mt-2.5">
                                <div className="flex justify-between items-center text-[10px] mb-1">
                                  <span className="text-slate-400">Risk Severity:</span>
                                  <span className={`font-mono font-bold ${getDangerTextColor(sensor.dangerScore)}`}>
                                    {sensor.dangerScore}%
                                  </span>
                                </div>
                                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${getDangerBarColor(sensor.dangerScore)}`}
                                    style={{ width: `${sensor.dangerScore}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Citizen Intel Stream */}
                    <div className="bg-[#0e1424] border border-slate-800/80 rounded-2xl p-4 shadow-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        <h2 className="font-display font-bold text-sm">Citizen Intel Stream</h2>
                      </div>
                      <div className="flex flex-col gap-3 max-h-[190px] overflow-y-auto">
                        {reports.map((rep) => (
                          <div key={rep.id} className="bg-slate-950/40 border border-slate-900 rounded-lg p-2.5 text-[11px]">
                            <div className="flex justify-between text-slate-400 mb-1">
                              <span className="font-bold text-slate-300">{rep.category}</span>
                              <span className="text-rose-400 bg-rose-950/30 px-1.5 py-0.5 rounded text-[9px]">{rep.severity} Alert</span>
                            </div>
                            <p className="text-slate-300 line-clamp-2 italic">"{rep.description}"</p>
                            <div className="text-[9px] text-slate-500 mt-1.5 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-600" /> {rep.locationName}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Diagnostic Detail Panel for Selected Sensor (cols: 8) */}
                  <div className="lg:col-span-8">
                    {selectedSensor && (
                      <div className="bg-[#0e1424] border border-slate-800/80 rounded-2xl p-5 shadow-xl">
                        
                        {/* Top Header of Selection */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800/60 mb-5">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded border border-indigo-500/20">
                                Selected Diagnostic Node
                              </span>
                              <span className="text-slate-500 font-mono text-[10px]">
                                Lat: {selectedSensor.latitude} • Lng: {selectedSensor.longitude}
                              </span>
                            </div>
                            <h3 className="font-display font-bold text-lg text-white">
                              {selectedSensor.name}
                            </h3>
                          </div>

                          {/* AI Trigger Tools Panel */}
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              id={`btn-ai-analyze-${selectedSensor.id}`}
                              onClick={() => handleRunAIAnalysis(selectedSensor.id)}
                              disabled={analyzingSensorId === selectedSensor.id}
                              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-mono text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              {analyzingSensorId === selectedSensor.id ? "Gemini Engineering Analysis..." : "Query Gemini AI Expert"}
                            </button>
                          </div>
                        </div>

                        {/* Scenario Injection Simulator Panel */}
                        <div className="mb-6 bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5">
                          <span className="text-[10px] font-mono text-indigo-400 font-bold block mb-2">
                            🛠️ PHYSICAL SCENARIO SIMULATOR (TEST SENSOR TRIGGERS)
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            {[
                              { name: "Wind Storm", color: "hover:bg-slate-800 hover:border-slate-700" },
                              { name: "Bird Landing", color: "hover:bg-slate-800 hover:border-slate-700" },
                              { name: "Truck Passing", color: "hover:bg-slate-800 hover:border-slate-700" },
                              { name: "Sledgehammer Blow", color: "hover:bg-rose-950/40 hover:border-rose-800/50" },
                              { name: "Angle Grinder Cutting", color: "hover:bg-rose-950/40 hover:border-rose-800/50" }
                            ].map((preset) => (
                              <button
                                id={`preset-${preset.name.replace(/\s+/g, "-").toLowerCase()}`}
                                key={preset.name}
                                onClick={() => handleTriggerPreset(selectedSensor.id, preset.name)}
                                className={`bg-slate-950 border border-slate-800/80 text-slate-300 rounded-lg py-1.5 px-2 text-[10px] font-medium transition-all ${preset.color}`}
                              >
                                {preset.name}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2">
                            *Injecting a physical scenario updates the sensor's raw proxies (vibration, strain, crest factor, acoustics) and runs the multi-sensor fusion classifier.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          
                          {/* Column A: Raw Measured Quantities */}
                          <div>
                            <h4 className="text-xs font-mono font-bold tracking-wider text-slate-400 mb-3 uppercase flex items-center gap-1">
                              <Activity className="w-3.5 h-3.5 text-indigo-400" />
                              Measured Sensor Proxies
                            </h4>
                            
                            <div className="space-y-3 font-mono">
                              {/* 1. Vibration / Structural Energy */}
                              <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3">
                                <div className="flex justify-between items-center text-xs mb-1.5">
                                  <span className="text-slate-400">Vibration Amplitude / Frequency</span>
                                  <span className="text-indigo-400 font-bold">{selectedSensor.readings.vibration} Hz</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, (selectedSensor.readings.vibration / 300) * 100)}%` }} />
                                </div>
                                <span className="text-[9px] text-slate-500 mt-1 block">Detects mechanical drills, sawing, and grinding</span>
                              </div>

                              {/* 2. Mechanical Cable Tension/Strain */}
                              <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3">
                                <div className="flex justify-between items-center text-xs mb-1.5">
                                  <span className="text-slate-400">Cable Structural Strain</span>
                                  <span className="text-emerald-400 font-bold">{selectedSensor.readings.strain} µε (microstrain)</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (selectedSensor.readings.strain / 500) * 100)}%` }} />
                                </div>
                                <span className="text-[9px] text-slate-500 mt-1 block">Measures mechanical tension drop-offs (cable slicing)</span>
                              </div>

                              {/* 3. Acoustic Profile */}
                              <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-3">
                                <div className="flex justify-between items-center text-xs mb-1.5">
                                  <span className="text-slate-400">Acoustic Level & Centroid</span>
                                  <span className="text-amber-500 font-bold">{selectedSensor.readings.acoustic} dB @ {selectedSensor.readings.acousticFreq}Hz</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, (selectedSensor.readings.acoustic / 120) * 100)}%` }} />
                                </div>
                                <span className="text-[9px] text-slate-500 mt-1 block">Metal-on-metal blows generate acoustic spikes &gt; 90dB</span>
                              </div>

                            </div>
                          </div>

                          {/* Column B: Discriminative Digital Waveform Features */}
                          <div>
                            <h4 className="text-xs font-mono font-bold tracking-wider text-slate-400 mb-3 uppercase flex items-center gap-1">
                              <Compass className="w-3.5 h-3.5 text-indigo-400" />
                              Waveform Discriminative Vectors
                            </h4>

                            <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4 space-y-4 font-mono text-xs">
                              <div>
                                <div className="flex justify-between text-[11px] mb-1">
                                  <span className="text-slate-400">Crest Factor (Impact sharpness)</span>
                                  <span className="text-slate-200">{selectedSensor.features.crestFactor}</span>
                                </div>
                                <p className="text-[9px] text-slate-500">Transient spikes (hammer blows) have crest factors &gt; 6.0</p>
                              </div>

                              <div className="border-t border-slate-900/60 pt-3">
                                <div className="flex justify-between text-[11px] mb-1">
                                  <span className="text-slate-400">Waveform Entropy (Randomness)</span>
                                  <span className="text-slate-200">{selectedSensor.features.spectralEntropy}</span>
                                </div>
                                <p className="text-[9px] text-slate-500">Continuous cutting/drilling shows highly structured entropy &lt; 0.4</p>
                              </div>

                              <div className="border-t border-slate-900/60 pt-3">
                                <div className="flex justify-between text-[11px] mb-1">
                                  <span className="text-slate-400">Peak Signal Amplitude</span>
                                  <span className="text-slate-200">{selectedSensor.features.peakAmplitude} mm/s</span>
                                </div>
                                <p className="text-[9px] text-slate-500">Peak physical movement velocity of the cable casing</p>
                              </div>

                              <div className="border-t border-slate-900/60 pt-3">
                                <div className="flex justify-between text-[11px] mb-1">
                                  <span className="text-slate-400">Adjacent Cross-Sensor Correlation</span>
                                  <span className="text-slate-200">{selectedSensor.features.crossSensorCorrelation}</span>
                                </div>
                                <p className="text-[9px] text-slate-500">High correlation indicates earthquake, storm, or heavy passing trucks</p>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded inline-block mt-1 font-bold ${
                                  selectedSensor.features.crossSensorCorrelation > 0.6 
                                    ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40" 
                                    : "bg-rose-950/40 text-rose-400 border border-rose-900/40"
                                }`}>
                                  {selectedSensor.features.crossSensorCorrelation > 0.6 
                                    ? "Likely environmental (high correlation)" 
                                    : "Highly isolated (likely human interference)"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* AI Expert Threat Analysis output */}
                        <div className="mt-6 border-t border-slate-800/80 pt-5">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded bg-indigo-500/10 flex items-center justify-center">
                              <Sparkles className="w-4 h-4 text-indigo-400" />
                            </div>
                            <h4 className="font-display font-bold text-sm text-white">Gemini AI Threat Assessment & Explanation</h4>
                          </div>

                          <div className="bg-[#111827]/40 border border-slate-800 rounded-xl p-4">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                <span>Calculated context time: <strong className="text-slate-300">{selectedSensor.features.timeOfDay}</strong></span>
                              </div>
                              <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded ${getDangerColor(selectedSensor.dangerScore)}`}>
                                AI Risk Level: {selectedSensor.dangerScore}%
                              </span>
                            </div>

                            <p className="text-xs text-slate-300 leading-relaxed mb-4 whitespace-pre-line">
                              {selectedSensor.explanation || "No advanced AI analytical review requested yet. Click the 'Query Gemini AI Expert' button to compile the waveform statistics, ambient weather conditions, and adjacent report contexts."}
                            </p>

                            {selectedSensor.suggestedActions && (
                              <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-900 text-xs">
                                <strong className="text-indigo-400 block mb-1 font-mono uppercase text-[10px] tracking-wider">🎯 Suggested Response Actions:</strong>
                                <p className="text-slate-300">{selectedSensor.suggestedActions}</p>
                              </div>
                            )}

                            {selectedSensor.educationalFact && (
                              <div className="mt-3 text-[11px] text-emerald-400 bg-emerald-950/20 px-3 py-2.5 rounded-lg border border-emerald-500/20 flex gap-2">
                                <BookOpen className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <p className="italic">
                                  <strong>Legal/Technical Fact:</strong> {selectedSensor.educationalFact}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>

                </div>

              </div>
            )}

            {/* TAB 2: SECURITY COMPANY PORTAL */}
            {activeTab === "security" && (
              <div className="space-y-6">
                
                {/* Security profile selector and quick stats */}
                <div className="bg-[#0e1424] border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Lock className="w-4 h-4 text-rose-500 animate-pulse" />
                      <span className="text-[10px] uppercase font-mono tracking-wider text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                        Classified Dispatch Console
                      </span>
                    </div>
                    <h2 className="font-display font-bold text-lg text-white">Tactical Security Operations Command</h2>
                    <p className="text-xs text-slate-400">Monitoring localized infrastructure threats within your immediate tactical response jurisdiction.</p>
                  </div>

                  {/* Profile Operator dropdown */}
                  <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 w-full sm:w-auto">
                    <span className="text-xs text-slate-400 font-mono">Active Operator:</span>
                    <select
                      id="security-operator-select"
                      value={selectedSecurityCompanyId}
                      onChange={(e) => setSelectedSecurityCompanyId(e.target.value)}
                      className="bg-slate-950 text-slate-200 text-xs font-bold font-sans border-0 focus:ring-0 cursor-pointer outline-none rounded p-1"
                    >
                      {securityCompanies.map(sc => (
                        <option key={sc.id} value={sc.id}>{sc.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* TOP ROW: Map centered on this security company and alerts list */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Security Company Focused Map (cols: 8) */}
                  <div className="lg:col-span-8 bg-[#0e1424] border border-slate-800/80 rounded-2xl p-4 shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Compass className="w-4 h-4 text-rose-500" />
                        <h2 className="font-display font-bold text-sm">Tactical Proximity Radar Map</h2>
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                        Jurisdiction: 45km patrol bubble
                      </span>
                    </div>

                    <div className="relative w-full h-[290px] bg-slate-950 rounded-xl overflow-hidden border border-slate-900 flex items-center justify-center">
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e1b1b_1px,transparent_1px),linear-gradient(to_bottom,#1e1b1b_1px,transparent_1px)] bg-[size:24px_24px] opacity-30" />
                      
                      {/* SVG Map of Gauteng with centered security base and alerts */}
                      <svg viewBox="0 0 800 500" className="w-full h-full p-4 opacity-75">
                        {/* Tshwane boundary */}
                        <path d="M 150,50 L 650,50 L 550,220 L 250,220 Z" fill="#1e293b" fillOpacity="0.05" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
                        {/* Joburg boundary */}
                        <path d="M 220,220 L 400,220 L 380,380 L 150,380 Z" fill="#1e293b" fillOpacity="0.05" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />
                        {/* Ekurhuleni boundary */}
                        <path d="M 400,220 L 680,220 L 620,380 L 380,380 Z" fill="#1e293b" fillOpacity="0.05" stroke="#334155" strokeWidth="1" strokeDasharray="3,3" />

                        {/* Draw connection lines from security base to active warnings */}
                        {(() => {
                          const sc = securityCompanies.find(c => c.id === selectedSecurityCompanyId) || securityCompanies[0];
                          const scX = ((sc.longitude - 27.4) / (28.6 - 27.4)) * 800;
                          const scY = ((sc.latitude - -25.4) / (-27.0 - -25.4)) * 500;

                          return sensors.filter(s => s.status !== "NORMAL").map(sensor => {
                            const senX = ((sensor.longitude - 27.4) / (28.6 - 27.4)) * 800;
                            const senY = ((sensor.latitude - -25.4) / (-27.0 - -25.4)) * 500;
                            const dist = getDistanceKm(sensor.latitude, sensor.longitude, sc.latitude, sc.longitude);

                            // Only draw line if within 45km range
                            if (dist > 45) return null;

                            return (
                              <g key={`line-${sensor.id}`}>
                                <line 
                                  x1={scX} 
                                  y1={scY} 
                                  x2={senX} 
                                  y2={senY} 
                                  stroke={sensor.status === "ALERT" ? "#ef4444" : "#f59e0b"} 
                                  strokeWidth="1.5" 
                                  strokeDasharray="5,5"
                                  className="animate-[dash_20s_linear_infinite]"
                                />
                                <circle cx={(scX + senX)/2} cy={(scY + senY)/2} r="9" fill="#0f172a" stroke="#475569" strokeWidth="1" />
                                <text 
                                  x={(scX + senX)/2} 
                                  y={(scY + senY)/2 + 3} 
                                  fill="#cbd5e1" 
                                  fontSize="8" 
                                  fontFamily="monospace" 
                                  textAnchor="middle"
                                >
                                  {Math.round(dist)}k
                                </text>
                              </g>
                            );
                          });
                        })()}
                      </svg>

                      {/* Map Coordinate Indicators Overlay */}
                      {(() => {
                        const activeSc = securityCompanies.find(sc => sc.id === selectedSecurityCompanyId) || securityCompanies[0];
                        const scX = ((activeSc.longitude - 27.4) / (28.6 - 27.4)) * 100;
                        const scY = ((activeSc.latitude - -25.4) / (-27.0 - -25.4)) * 100;

                        return (
                          <>
                            {/* Security base icon */}
                            <div 
                              className="absolute -translate-x-1/2 -translate-y-1/2 z-30"
                              style={{ left: `${scX}%`, top: `${scY}%` }}
                            >
                              <div className="relative flex h-8 w-8 items-center justify-center">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-20" />
                                <div className="bg-emerald-500 border-2 border-slate-950 p-1.5 rounded-lg shadow-lg text-slate-950">
                                  <ShieldAlert className="w-4 h-4 stroke-[2.5]" />
                                </div>
                              </div>
                              <div className="absolute top-9 left-1/2 -translate-x-1/2 bg-emerald-950/90 border border-emerald-500/40 text-[9px] font-mono text-emerald-300 px-2 py-0.5 rounded shadow-xl whitespace-nowrap">
                                {activeSc.name} (Base)
                              </div>
                            </div>

                            {/* Nearby Sensors indicators */}
                            {sensors.map((sensor) => {
                              const x = ((sensor.longitude - 27.4) / (28.6 - 27.4)) * 100;
                              const y = ((sensor.latitude - -25.4) / (-27.0 - -25.4)) * 100;
                              const dist = getDistanceKm(sensor.latitude, sensor.longitude, activeSc.latitude, activeSc.longitude);

                              // For the security company operator view, show alerts in full, other sensors as small dots
                              const isAlert = sensor.status !== "NORMAL";
                              if (!isAlert && dist > 45) return null; // hide far away normal sensors

                              const markerColor = sensor.status === "ALERT" 
                                ? "bg-rose-600 ring-rose-500 animate-bounce" 
                                : sensor.status === "WARNING" 
                                ? "bg-amber-500 ring-amber-400" 
                                : "bg-slate-600 ring-slate-700";

                              return (
                                <button
                                  key={`sec-map-sensor-${sensor.id}`}
                                  onClick={() => {
                                    setActiveTab("government");
                                    setSelectedSensor(sensor);
                                  }}
                                  className={`absolute -translate-x-1/2 -translate-y-1/2 group transition-all duration-300 ${isAlert ? "z-20 scale-110" : "z-10 scale-90"}`}
                                  style={{ left: `${x}%`, top: `${y}%` }}
                                >
                                  <span className="relative flex h-5 w-5 items-center justify-center">
                                    {sensor.status === "ALERT" && (
                                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                                    )}
                                    <span className={`relative inline-flex rounded-full h-3 w-3 ${markerColor} ring-4 ring-slate-950 border border-white/15`} />
                                  </span>
                                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-[9px] text-white px-2 py-1 rounded border border-slate-800 whitespace-nowrap z-40 shadow-xl">
                                    <span className="font-bold block">{sensor.name}</span>
                                    <span className="text-slate-400">Distance: {Math.round(dist)}km • Risk: {sensor.dangerScore}%</span>
                                  </div>
                                </button>
                              );
                            })}
                          </>
                        );
                      })()}

                      {/* Map Legend */}
                      <div className="absolute bottom-3 left-3 bg-slate-900/95 border border-slate-800 px-3 py-1.5 rounded-lg text-[8px] font-mono flex gap-4 z-10 shadow-lg">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded bg-emerald-500 flex items-center justify-center text-[6px] text-slate-950 font-bold">S</span>
                          <span>Your Active Base</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
                          <span>Critical Danger</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          <span>Proximity Hazard</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Active Security Company Stats Panel (cols: 4) */}
                  {(() => {
                    const activeSc = securityCompanies.find(sc => sc.id === selectedSecurityCompanyId) || securityCompanies[0];
                    const closeAlarms = sensors.filter(s => s.status !== "NORMAL" && getDistanceKm(s.latitude, s.longitude, activeSc.latitude, activeSc.longitude) <= 45);

                    return (
                      <div className="lg:col-span-4 bg-[#0e1424] border border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
                            <h2 className="font-display font-bold text-sm">Station Dispatch Status</h2>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 text-center">
                              <span className="text-[9px] text-slate-500 font-mono block uppercase">Active Fleet</span>
                              <span className="text-lg font-bold text-emerald-400 font-mono">{activeSc.availableVehicles} Units</span>
                            </div>
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 text-center">
                              <span className="text-[9px] text-slate-500 font-mono block uppercase">Nearby Dangers</span>
                              <span className={`text-lg font-bold font-mono ${closeAlarms.length > 0 ? "text-rose-400 animate-pulse" : "text-emerald-400"}`}>
                                {closeAlarms.length} Alerts
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-900 text-xs">
                              <span className="text-[9px] text-indigo-400 font-mono block font-bold mb-1">STATION PATROL REGION:</span>
                              <p className="text-slate-300 font-semibold">{activeSc.baseLocation}</p>
                              <span className="text-[10px] text-slate-500 font-mono mt-1 block">GPS Base: {activeSc.latitude}, {activeSc.longitude}</span>
                            </div>

                            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-900 text-xs">
                              <span className="text-[9px] text-indigo-400 font-mono block font-bold mb-1">EMERGENCY HOTLINE:</span>
                              <p className="text-slate-200 font-bold text-sm tracking-wider">{activeSc.contact}</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
                          * Dispatch console tracks the live GPS proximity. Alerts outside the 45km sector are automatically routed to neighboring task force stations.
                        </div>
                      </div>
                    );
                  })()}

                </div>

                {/* BOTTOM ROW: Localized Emergency Alerts Queue (Only showing what this single security company sees) */}
                <div className="bg-[#0e1424] border border-slate-800/80 rounded-2xl p-5 shadow-xl">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full bg-rose-600 animate-pulse" />
                      <h2 className="font-display font-bold text-sm text-white">Emergency Local Jurisdiction Dispatch Queue</h2>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono">SHOWING THREATS IN YOUR 45KM RANGE ONLY</span>
                  </div>

                  {(() => {
                    const activeSc = securityCompanies.find(sc => sc.id === selectedSecurityCompanyId) || securityCompanies[0];
                    const localizedThreats = sensors
                      .filter(s => s.status !== "NORMAL")
                      .map(s => ({
                        ...s,
                        distance: getDistanceKm(s.latitude, s.longitude, activeSc.latitude, activeSc.longitude)
                      }))
                      .filter(s => s.distance <= 45) // ONLY show what a single security company will see!
                      .sort((a, b) => a.distance - b.distance);

                    if (localizedThreats.length === 0) {
                      return (
                        <div className="bg-slate-950/40 border border-slate-900 border-dashed rounded-xl py-12 flex flex-col items-center justify-center text-center">
                          <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                          <h3 className="font-display font-bold text-sm text-slate-200">Local Jurisdiction Secure</h3>
                          <p className="text-xs text-slate-500 max-w-sm mt-1">
                            No active high-risk warnings or cut alerts identified within the {activeSc.name} response radius.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {localizedThreats.map((sensor) => {
                          const dispatchState = dispatchedUnits[sensor.id];
                          return (
                            <div 
                              key={`sec-dispatch-${sensor.id}`} 
                              className={`border rounded-xl p-4 transition-all ${
                                sensor.status === "ALERT" 
                                  ? "bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-950/10" 
                                  : "bg-amber-950/20 border-amber-500/40"
                              }`}
                            >
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                                    sensor.status === "ALERT" ? "bg-rose-500 text-slate-950 animate-pulse" : "bg-amber-500 text-slate-950"
                                  }`}>
                                    {sensor.status} STATE
                                  </span>
                                  <h3 className="font-display font-bold text-sm text-slate-100 mt-1.5">{sensor.name}</h3>
                                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{sensor.municipality}</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-slate-500 block">Distance to Base:</span>
                                  <span className="font-mono font-bold text-sm text-slate-200 block">
                                    {Math.round(sensor.distance)} km
                                  </span>
                                  <span className="text-[9px] text-emerald-400 font-mono block">ETA: {Math.max(2, Math.round(sensor.distance * 1.5))} mins</span>
                                </div>
                              </div>

                              <div className="space-y-2 mb-4 text-xs font-mono text-slate-300">
                                <div className="bg-slate-950/50 p-2.5 rounded border border-slate-900 text-[11px] leading-relaxed">
                                  <span className="text-[9px] text-indigo-400 block font-bold mb-0.5">WAVEFORM EXPLANATION:</span>
                                  {sensor.explanation || "Mechanical tension discrepancy and acoustic vibration triggers identified near this site."}
                                </div>
                              </div>

                              {/* Dispatch Trigger Controls */}
                              {dispatchState ? (
                                <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-lg p-3 text-center flex items-center justify-center gap-2 text-xs font-mono text-emerald-400">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 animate-bounce" />
                                  <span>{dispatchState} IN ROUTE</span>
                                </div>
                              ) : (
                                <button
                                  id={`btn-dispatch-${sensor.id}`}
                                  onClick={() => setDispatchedUnits(prev => ({ ...prev, [sensor.id]: activeSc.name }))}
                                  className="w-full bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md shadow-rose-950/40"
                                >
                                  <Zap className="w-3.5 h-3.5" />
                                  Authorize emergency {activeSc.name} dispatch
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Grid coordinates and security units registry */}
                <div className="bg-[#0e1424] border border-slate-800/80 rounded-2xl p-5 shadow-xl">
                  <h2 className="font-display font-bold text-sm mb-4 text-white font-sans">South African Provincial Task Force Stations (Gauteng)</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {securityCompanies.map((sc) => {
                      const isSelf = sc.id === selectedSecurityCompanyId;
                      return (
                        <div 
                          key={sc.id} 
                          className={`rounded-xl p-3.5 flex flex-col justify-between border ${
                            isSelf 
                              ? "bg-emerald-950/15 border-emerald-500/40 shadow-md shadow-emerald-950/20" 
                              : "bg-slate-950 border-slate-900/80"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[8px] font-mono text-slate-500 uppercase">STATION ID: {sc.id}</span>
                              {isSelf && (
                                <span className="text-[7px] uppercase font-mono bg-emerald-500/10 text-emerald-400 px-1 py-0.2 rounded border border-emerald-500/20">
                                  YOU
                                </span>
                              )}
                            </div>
                            <h3 className="text-xs font-bold text-white mb-1.5">{sc.name}</h3>
                            <p className="text-[10px] text-slate-400 mb-2">{sc.baseLocation}</p>
                          </div>
                          <div className="border-t border-slate-900/60 pt-2.5 mt-2 flex flex-col gap-1 text-[10px] font-mono">
                            <span className="text-emerald-400 font-bold">{sc.availableVehicles} Patrol Units Active</span>
                            <span className="text-slate-500 text-[9px]">Lat: {sc.latitude} • Lng: {sc.longitude}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* TAB 3: CITIZEN REPORTING & WARNINGS */}
            {activeTab === "citizen" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Form Panel: Report Suspicious Behavior */}
                <div className="lg:col-span-5 bg-[#0e1424] border border-slate-800/80 rounded-2xl p-5 shadow-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <h2 className="font-display font-bold text-base text-white">Report Cable Theft / Suspicious Acts</h2>
                  </div>
                  <p className="text-xs text-slate-400 mb-5">
                    Your eyes protect the grid. Report unmarked vehicles digging up roadways, ladders placed on poles at odd hours, or open electrical cabinets.
                  </p>

                  <form onSubmit={handleSubmitReport} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Incident Title *</label>
                      <input
                        id="input-rep-title"
                        type="text"
                        required
                        value={reportTitle}
                        onChange={(e) => setReportTitle(e.target.value)}
                        placeholder="e.g., Unlabeled white van cutting wire under bridge"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2.5 text-slate-200 outline-none transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Municipality *</label>
                        <select
                          id="select-rep-muni"
                          value={reportMunicipality}
                          onChange={(e) => setReportMunicipality(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 text-slate-200 outline-none"
                        >
                          <option value="City of Johannesburg">City of Joburg</option>
                          <option value="City of Tshwane">City of Tshwane</option>
                          <option value="City of Ekurhuleni">City of Ekurhuleni</option>
                          <option value="West Rand District">West Rand District</option>
                          <option value="Sedibeng District">Sedibeng District</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Category *</label>
                        <select
                          id="select-rep-category"
                          value={reportCategory}
                          onChange={(e) => setReportCategory(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 text-slate-200 outline-none"
                        >
                          <option value="Suspicious Loitering">Loitering</option>
                          <option value="Unmarked Digging">Unmarked Digging</option>
                          <option value="Open Cable Manhole">Open Manhole</option>
                          <option value="Vandalism in Progress">Vandalism</option>
                          <option value="Sparking/Smoke">Sparking/Smoke</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Threat Severity *</label>
                        <select
                          id="select-rep-severity"
                          value={reportSeverity}
                          onChange={(e) => setReportSeverity(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 text-slate-200 outline-none"
                        >
                          <option value="Low">Low (No active tool seen)</option>
                          <option value="Medium">Medium (Suspicious tools/acting)</option>
                          <option value="High">High (Active sawing/vandalism)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 font-semibold">Street Location / Landmark *</label>
                        <input
                          id="input-rep-location"
                          type="text"
                          required
                          value={reportLocation}
                          onChange={(e) => setReportLocation(e.target.value)}
                          placeholder="e.g., Corner R51 and Main, Germiston"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2.5 text-slate-200 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">What did you observe? *</label>
                      <textarea
                        id="textarea-rep-desc"
                        required
                        rows={3}
                        value={reportDesc}
                        onChange={(e) => setReportDesc(e.target.value)}
                        placeholder="Please describe vehicles, uniforms, or tools. (Note: reports automatically elevate the nearest sensor's danger index and notify nearby response patrols.)"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-lg p-2.5 text-slate-200 outline-none transition-all resize-none"
                      />
                    </div>

                    <button
                      id="btn-submit-report"
                      type="submit"
                      disabled={isSubmittingReport}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-mono font-bold py-2 px-3 rounded-lg transition-all"
                    >
                      {isSubmittingReport ? "Registering report..." : "Submit Confidential Report"}
                    </button>

                    {reportSuccess && (
                      <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-lg p-3 text-emerald-400 font-mono text-xs flex gap-2 items-center">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Report logged securely. Nearby sensor grid values adjusted to reflect public feedback!</span>
                      </div>
                    )}
                  </form>
                </div>

                {/* Right Panel: Warnings & Educational Insights */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                  
                  {/* Public Warnings based on sensor state */}
                  <div className="bg-[#0e1424] border border-slate-800/80 rounded-2xl p-5 shadow-xl">
                    <div className="flex items-center gap-2 mb-4">
                      <Radio className="w-5 h-5 text-indigo-400" />
                      <h2 className="font-display font-bold text-base text-white">Live Community Safety Wall</h2>
                    </div>

                    <div className="space-y-3.5">
                      {sensors.map((sensor) => {
                        const alertText = sensor.citizenAlert;
                        const hasAlert = sensor.status !== "NORMAL" || alertText;
                        if (!hasAlert) return null;

                        return (
                          <div 
                            key={sensor.id} 
                            className={`border rounded-xl p-3.5 flex gap-3.5 items-start ${
                              sensor.status === "ALERT" 
                                ? "bg-rose-950/15 border-rose-500/30 text-rose-200" 
                                : "bg-amber-950/15 border-amber-500/30 text-amber-200"
                            }`}
                          >
                            <div className="p-2 rounded bg-slate-950/60 border border-slate-900 mt-0.5 shrink-0">
                              <AlertTriangle className={`w-4 h-4 ${sensor.status === "ALERT" ? "text-rose-500" : "text-amber-500"}`} />
                            </div>
                            <div>
                              <div className="flex justify-between items-center flex-wrap gap-2 mb-1">
                                <span className="font-bold text-xs">{sensor.name} Grid warning</span>
                                <span className="text-[9px] font-mono opacity-80">{sensor.lastUpdated}</span>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed">
                                {alertText || `Elevated threat detected near ${sensor.name}. Local residents should report all suspicious activities.`}
                              </p>
                            </div>
                          </div>
                        );
                      })}

                      {sensors.filter(s => s.status !== "NORMAL").length === 0 && (
                        <div className="bg-slate-950/40 border border-slate-900 border-dashed rounded-xl py-6 flex flex-col items-center justify-center text-center">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-1.5" />
                          <h3 className="font-display font-bold text-xs text-slate-300">All local sectors safe</h3>
                          <p className="text-[11px] text-slate-500">
                            No active power or rail cable warnings reported by our SentinelAI sensors.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Educational Facts & Crisis Context Grid */}
                  <div className="bg-[#0e1424] border border-slate-800/80 rounded-2xl p-5 shadow-xl">
                    <div className="flex items-center gap-2 mb-4">
                      <BookOpen className="w-5 h-5 text-emerald-400" />
                      <h2 className="font-display font-bold text-base text-white">Educational Facts & Legal Regulations</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 text-xs flex flex-col justify-between">
                        <div>
                          <span className="font-mono text-emerald-400 text-[10px] block mb-1">⚖️ PRISON SENTENCES</span>
                          <h4 className="font-bold text-slate-200 mb-1.5">Criminal Matters Amendment Act</h4>
                          <p className="text-slate-400 leading-relaxed">
                            Under South African Act 24 of 2015, interference, damage, or theft of public power lines, water pumps, or railway signals carries a minimum penalty of <strong>15 to 30 years in prison</strong>.
                          </p>
                        </div>
                        <span className="text-[9px] font-mono text-slate-600 block mt-3">Ref: RSA Statutes Act 24</span>
                      </div>

                      <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 text-xs flex flex-col justify-between">
                        <div>
                          <span className="font-mono text-emerald-400 text-[10px] block mb-1">⚡ ECONOMIC IMPACT</span>
                          <h4 className="font-bold text-slate-200 mb-1.5">R47 Billion Annual Loss</h4>
                          <p className="text-slate-400 leading-relaxed">
                            Copper cable theft doesn't just cause blackouts; it disrupts high-speed commuter trains (Gautrain/Metrorail), cuts off municipal water reservoirs, and drains billions from business operations.
                          </p>
                        </div>
                        <span className="text-[9px] font-mono text-slate-600 block mt-3">Source: CSIR Economic Bulletin</span>
                      </div>

                      <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 text-xs flex flex-col justify-between">
                        <div>
                          <span className="font-mono text-emerald-400 text-[10px] block mb-1">🛡️ HIGH-TECH SENSORS</span>
                          <h4 className="font-bold text-slate-200 mb-1.5">Fiber Acoustic Arrays</h4>
                          <p className="text-slate-400 leading-relaxed">
                            New techniques turn normal fiber lines along railway tracks into continuous microphones. By passing laser pulses down the cable, the system measures micro-vibration changes from digging.
                          </p>
                        </div>
                        <span className="text-[9px] font-mono text-slate-600 block mt-3">DAS (Distributed Acoustic Sensing)</span>
                      </div>

                      <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 text-xs flex flex-col justify-between">
                        <div>
                          <span className="font-mono text-emerald-400 text-[10px] block mb-1">💡 NO COPPER VALUE</span>
                          <h4 className="font-bold text-slate-200 mb-1.5">Alternative Alloy Cables</h4>
                          <p className="text-slate-400 leading-relaxed">
                            PRASA and Eskom are gradually swapping copper cabling in high-theft sectors with newly engineered hybrid composites and aluminum alloys that have <strong>no scrap metal value</strong>.
                          </p>
                        </div>
                        <span className="text-[9px] font-mono text-slate-600 block mt-3">Eskom Modernization Grid</span>
                      </div>

                    </div>
                  </div>

                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#070b13] py-8 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© 2026 SentinelAI Province Hub. Built for South African Provincial Infrastructure Task Force.</p>
          <div className="flex gap-4 font-mono text-[10px]">
            <span>Active Sector: Gauteng</span>
            <span>Version: 2.1.0-TS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
