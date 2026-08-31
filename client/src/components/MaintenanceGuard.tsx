import React, { useEffect, useState } from "react";
import { 
  RefreshCw, Wrench, Settings, Instagram, Facebook, 
  MessageSquare, Calendar, AlertTriangle, HelpCircle, 
  Share2, Hash
} from "lucide-react";

interface MaintenanceGuardProps {
  children: React.ReactNode;
  productKey: string;
}

interface MaintenanceStatus {
  maintenance: boolean;
  maintenanceType?: string;
  title?: string;
  message?: string;
  expectedBackAt?: string;
  productName?: string;
}

const SUPABASE_URL = "https://uklxlappjcuvdqjvecfh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrbHhsYXBwamN1dmRxanZlY2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNDcwODMsImV4cCI6MjA4MzcyMzA4M30.v-TvyQrYpttcmCnzT9MkUlBgGXXU3lspZCxCYm-Oil4";

// Custom animations for the playful Social Pilot illustration
const customStyles = `
  @keyframes gap-rotate-tool {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes gap-float-card-1 {
    0%, 100% { transform: translateY(0px) rotate(-4deg); }
    50% { transform: translateY(-15px) rotate(-1deg); }
  }
  @keyframes gap-float-card-2 {
    0%, 100% { transform: translateY(0px) rotate(6deg); }
    50% { transform: translateY(-20px) rotate(3deg); }
  }
  @keyframes gap-float-card-3 {
    0%, 100% { transform: translateY(0px) rotate(2deg) scale(1); }
    50% { transform: translateY(12px) rotate(5deg) scale(1.05); }
  }
  @keyframes gap-wire-flow {
    to { stroke-dashoffset: -400; }
  }
  @keyframes gap-pulse-warning {
    0%, 100% { transform: scale(1) rotate(-10deg); opacity: 0.9; }
    50% { transform: scale(1.05) rotate(-8deg); opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .anim-rotate-tool, .anim-float-1, .anim-float-2, .anim-float-3, .anim-wire-flow, .anim-warning {
      animation: none !important;
      transform: none !important;
    }
  }

  .anim-rotate-tool { animation: gap-rotate-tool 12s linear infinite; }
  .anim-float-1 { animation: gap-float-card-1 6s ease-in-out infinite; }
  .anim-float-2 { animation: gap-float-card-2 8s ease-in-out infinite 1s; }
  .anim-float-3 { animation: gap-float-card-3 7s ease-in-out infinite 2s; }
  .anim-wire-flow { animation: gap-wire-flow 20s linear infinite; }
  .anim-warning { animation: gap-pulse-warning 4s ease-in-out infinite; }
`;

export default function MaintenanceGuard({ children, productKey }: MaintenanceGuardProps) {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    const checkStatus = async () => {
      try {
        const headers = {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json"
        };

        const [globalRes, productRes] = await Promise.all([
          fetch(`${SUPABASE_URL}/rest/v1/system_settings?select=*`, { headers }),
          fetch(`${SUPABASE_URL}/rest/v1/system_products?product_key=eq.${productKey}&select=*`, { headers })
        ]);

        if (!globalRes.ok || !productRes.ok) throw new Error("Failed to fetch maintenance status");

        const globalData = await globalRes.json();
        const productData = await productRes.json();
        
        const globalSettings = globalData[0] || {};
        const product = productData[0] || {};

        if (mounted) {
          const now = new Date();
          
          let isGlobalMaintenance = globalSettings.global_maintenance_enabled;
          if (isGlobalMaintenance && globalSettings.end_at && new Date(globalSettings.end_at) <= now) {
              isGlobalMaintenance = false;
          }
          const isGlobalScheduleActive = globalSettings.start_at && globalSettings.end_at && 
            new Date(globalSettings.start_at) <= now && new Date(globalSettings.end_at) > now;
          const effectiveGlobalMaintenance = isGlobalMaintenance || isGlobalScheduleActive;

          let isProductMaintenance = product.maintenance_enabled;
          if (isProductMaintenance && product.maintenance_end_at && new Date(product.maintenance_end_at) <= now) {
              isProductMaintenance = false;
          }
          const isProductScheduled = product.maintenance_start_at && product.maintenance_end_at &&
            new Date(product.maintenance_start_at) <= now && new Date(product.maintenance_end_at) > now;
            
          const isMaintenance = effectiveGlobalMaintenance || isProductMaintenance || isProductScheduled;
          
          let title = product.maintenance_title || "WE'LL BE BACK SOON!";
          let message = product.maintenance_message || `We're doing some quick maintenance. Thanks for your patience!`;
          let expectedBackAt = product.maintenance_end_at;
          
          if (effectiveGlobalMaintenance) {
              title = globalSettings.title || "WE'LL BE BACK SOON!";
              message = globalSettings.message || "We're doing some quick maintenance. Thanks for your patience!";
              expectedBackAt = globalSettings.end_at;
          }

          let maintenanceType = "System Update";
          if (effectiveGlobalMaintenance) maintenanceType = "Global Maintenance";
          else if (isProductScheduled) maintenanceType = "Scheduled Maintenance";

          setStatus({
            maintenance: !!isMaintenance,
            maintenanceType,
            title: title.toUpperCase(),
            message,
            expectedBackAt,
            productName: product.product_name || "GAP Social Pilot"
          });
        }
      } catch (error) {
        console.error("Maintenance check failed:", error);
        if (mounted) setStatus({ maintenance: false });
      } finally {
        if (mounted) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [productKey]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  if (loading && !status) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F5F1EC]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-[#D3CEC6] border-t-[#E84F00] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (status?.maintenance) {
    let formattedTime = null;
    if (status.expectedBackAt) {
      const expectedDate = new Date(status.expectedBackAt);
      if (expectedDate > new Date()) {
        const isToday = expectedDate.toDateString() === new Date().toDateString();
        const timeString = expectedDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        formattedTime = isToday ? `Today at ${timeString}` : `${expectedDate.toLocaleDateString()} at ${timeString}`;
      }
    }

    return (
      <div className="relative min-h-[100dvh] w-full bg-[#F5F1EC] overflow-hidden flex flex-col font-sans text-[#111111]">
        <style dangerouslySetInnerHTML={{ __html: customStyles }} />

        {/* Top Header Logotype */}
        <header className="absolute top-0 left-0 w-full px-6 py-6 md:px-8 flex justify-center md:justify-start items-center z-40">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="GAP Social Pilot" className="h-8 w-auto object-contain" />
            <span className="text-[#111111] font-extrabold tracking-tight text-lg">
              Social Pilot
            </span>
          </div>
        </header>

        {/* Top Content: Headline, Message, CTA (Top-heavy layout) */}
        <main className="relative z-30 flex flex-col items-center justify-start pt-[12vh] md:pt-[15vh] px-4 w-full max-w-4xl mx-auto flex-shrink-0">
          <h1 className="text-[clamp(48px,8vw,96px)] font-black text-center text-[#111111] leading-[0.95] tracking-tight mb-4">
            {status.title}
          </h1>
          
          <p className="text-[18px] md:text-[22px] font-medium text-center text-[#626260] leading-snug mb-8 max-w-2xl">
            {status.message}
            {formattedTime && <span className="block mt-2 font-bold text-[#E84F00]">Expected return: {formattedTime}</span>}
          </p>

          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="group relative px-10 h-14 rounded-full bg-[#E84F00] text-white font-bold text-[18px] flex items-center justify-center gap-2 transition-transform duration-200 hover:scale-105 hover:bg-[#FF5600] active:scale-95 disabled:opacity-70 disabled:hover:scale-100 shadow-xl shadow-[#E84F00]/20 z-40"
          >
            {isRefreshing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              "Check Again"
            )}
          </button>
        </main>

        {/* Bottom Content: The Massive Custom Illustration Scene */}
        <div className="relative flex-1 w-full mt-4 min-h-[400px] pointer-events-none z-10 overflow-hidden">
          
          {/* Colorful SVG Connection Wires Background */}
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax slice">
            {/* Green wire */}
            <path 
              d="M -100 250 C 200 150 400 350 700 250 C 900 150 1200 300 1400 200" 
              fill="none" stroke="#22c55e" strokeWidth="6" 
              className="anim-wire-flow" strokeDasharray="30 15"
            />
            {/* Orange wire */}
            <path 
              d="M -50 350 C 300 450 500 150 800 250 C 1000 300 1100 450 1500 350" 
              fill="none" stroke="#E84F00" strokeWidth="8" 
              className="anim-wire-flow" strokeDasharray="50 20"
              style={{ animationDirection: 'reverse', animationDuration: '25s' }}
            />
            {/* Blue wire */}
            <path 
              d="M 100 150 C 400 50 600 400 900 350 C 1100 300 1300 150 1600 250" 
              fill="none" stroke="#0007CB" strokeWidth="4" 
              className="anim-wire-flow" strokeDasharray="15 15"
            />
            {/* Yellow wire */}
            <path 
              d="M 0 300 C 250 200 450 300 650 150 C 850 50 1150 250 1350 100" 
              fill="none" stroke="#F59E0B" strokeWidth="5" 
              className="anim-wire-flow" strokeDasharray="20 10"
              style={{ animationDuration: '15s' }}
            />
          </svg>

          {/* Abstract "Engineer" / Automation Gear Core (Center Bottom) */}
          <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[350px] md:w-[500px] h-[350px] md:h-[500px] flex items-center justify-center z-20">
            {/* Huge background gear */}
            <div className="absolute inset-0 bg-[#D3CEC6]/30 rounded-full anim-rotate-tool border-[20px] border-dashed border-[#D3CEC6]/40" />
            
            {/* Stylized fixing element */}
            <div className="relative w-48 h-48 md:w-64 md:h-64 bg-[#111111] rounded-3xl rotate-12 flex flex-col items-center justify-center shadow-2xl border-8 border-[#FFFFFF]">
              <Settings className="w-20 h-20 text-[#F5F1EC] anim-rotate-tool" strokeWidth={1.5} />
              <div className="mt-4 flex gap-3">
                <div className="w-4 h-4 rounded-full bg-[#22c55e] animate-pulse" />
                <div className="w-4 h-4 rounded-full bg-[#F59E0B] animate-pulse delay-75" />
                <div className="w-4 h-4 rounded-full bg-[#EF4444] animate-pulse delay-150" />
              </div>
              
              {/* Giant Wrench Overlay */}
              <div className="absolute -top-16 -right-12 bg-[#F59E0B] p-4 rounded-xl rotate-[35deg] shadow-xl border-4 border-[#111111]">
                <Wrench className="w-16 h-16 text-[#111111]" strokeWidth={2} />
              </div>
            </div>
          </div>

          {/* Floating UI Card 1: Instagram Post UI */}
          <div className="absolute bottom-[40%] left-[5%] md:left-[15%] anim-float-1 z-30">
            <div className="bg-[#FFFFFF] p-4 rounded-2xl shadow-xl border-2 border-[#111111] w-[200px] md:w-[240px] -rotate-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 flex items-center justify-center text-white">
                  <Instagram className="w-4 h-4" />
                </div>
                <div className="h-3 w-20 bg-[#D3CEC6] rounded-full" />
              </div>
              <div className="h-[120px] bg-[#F5F1EC] rounded-lg mb-3 flex items-center justify-center border border-[#D3CEC6]">
                <Share2 className="w-8 h-8 text-[#D3CEC6]" />
              </div>
              <div className="h-2 w-full bg-[#D3CEC6] rounded-full mb-2" />
              <div className="h-2 w-2/3 bg-[#D3CEC6] rounded-full" />
            </div>
          </div>

          {/* Floating UI Card 2: Facebook/Threads Text Post */}
          <div className="absolute bottom-[20%] right-[5%] md:right-[15%] anim-float-2 z-30">
            <div className="bg-[#FFFFFF] p-5 rounded-2xl shadow-xl border-2 border-[#0007CB] w-[220px] md:w-[260px] rotate-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#0007CB] flex items-center justify-center text-white">
                  <Facebook className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="h-3 w-16 bg-[#111111] rounded-full mb-1.5" />
                  <div className="h-2 w-10 bg-[#626260] rounded-full" />
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="h-2 w-full bg-[#D3CEC6] rounded-full" />
                <div className="h-2 w-[90%] bg-[#D3CEC6] rounded-full" />
                <div className="h-2 w-[60%] bg-[#D3CEC6] rounded-full" />
              </div>
              <div className="flex items-center gap-3 pt-3 border-t border-[#D3CEC6]">
                <MessageSquare className="w-4 h-4 text-[#626260]" />
                <Hash className="w-4 h-4 text-[#626260]" />
              </div>
            </div>
          </div>

          {/* Floating UI Card 3: Scheduling/Calendar */}
          <div className="absolute top-[10%] right-[10%] md:right-[30%] anim-float-3 z-20">
            <div className="bg-[#111111] p-4 rounded-2xl shadow-2xl border-2 border-[#E84F00] w-[180px] rotate-[-12deg]">
              <div className="flex items-center justify-between mb-3 border-b border-[#626260] pb-2">
                <Calendar className="w-5 h-5 text-[#E84F00]" />
                <span className="text-[#F5F1EC] text-xs font-bold">Scheduled</span>
              </div>
              <div className="grid grid-cols-4 gap-1 mb-2">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className={`h-6 rounded-sm ${i === 4 ? 'bg-[#E84F00]' : i === 7 ? 'bg-[#0007CB]' : 'bg-[#626260]/40'}`} />
                ))}
              </div>
            </div>
          </div>

          {/* Giant Warning Triangle Decor (Left) */}
          <div className="absolute bottom-[5%] left-[2%] md:left-[10%] anim-warning z-40 hidden sm:flex">
            <div className="relative">
              <svg width="120" height="120" viewBox="0 0 24 24" fill="#F59E0B" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center pt-2">
                <HelpCircle className="w-12 h-12 text-[#111111]" />
              </div>
            </div>
          </div>

          {/* Giant Warning Triangle Decor (Right) */}
          <div className="absolute bottom-[35%] right-[2%] md:right-[5%] anim-warning z-40 hidden lg:flex" style={{ animationDelay: '-2s' }}>
            <div className="relative rotate-[25deg]">
              <svg width="140" height="140" viewBox="0 0 24 24" fill="#F59E0B" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center pt-2">
                <AlertTriangle className="w-14 h-14 text-[#111111]" />
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return <>{children}</>;
}
