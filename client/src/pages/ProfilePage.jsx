import React, { useState } from 'react';
import { LogOut, ChevronRight, Mail, Phone, Instagram, Facebook, Globe, MapPin, Briefcase, UserRound, Shield, CreditCard, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAutoDM } from '../context/AutoDMContext';
import ConnectedPlatformsPanel from '../components/platforms/ConnectedPlatformsPanel';
import BillingPage from './BillingPage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function ProfileSettingsPanel({ user }) {
  return (
    <div className="flex flex-col xl:flex-row gap-8 mt-6">
      {/* Left Column Summary Card */}
      <div className="w-full xl:w-[380px] shrink-0 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-black/10 overflow-hidden">
          {/* Header Graphic */}
          <div className="bg-[#fcfbf9] h-40 w-full border-b border-black/5 flex items-center justify-center relative overflow-hidden">
             <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-200 via-[#fcfbf9] to-[#fcfbf9]"></div>
             <img src="https://illustrations.popsy.co/amber/freelancer.svg" alt="Illustration" className="h-48 absolute -bottom-4 right-0 mix-blend-multiply opacity-90" />
          </div>
          
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#1a1a1a]">{user?.name || 'Getaipilot'}</h2>
                <p className="text-[#666666] text-sm font-medium mt-0.5">Musicians</p>
                <p className="text-xs text-[#888888] mt-1.5 flex items-center gap-1">
                   <MapPin className="w-3.5 h-3.5" />
                   Bhopal, Madhya Pradesh
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Online
              </div>
            </div>

            <div className="mt-6 border-t border-black/5 pt-6">
               {(() => {
                 const subscription = user?.entitlements?.subscription;
                 const planId = user?.entitlements?.plan?.id || 'free';
                 const planStatus = subscription?.status || 'inactive';

                 const planLabel = user?.entitlements?.plan?.name || 'Free';

                 let daysRemaining = 0;
                 let percentRemaining = 0;
                 const isForever = planId === 'free';

                 if (subscription?.current_period_end) {
                   const diffTime = new Date(subscription.current_period_end) - new Date();
                   daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                   
                   const interval = subscription?.billing_interval || 'monthly';
                   let totalDays = 30;
                   if (interval === 'quarterly') totalDays = 90;
                   else if (interval === 'six_months') totalDays = 180;
                   else if (interval === 'year' || interval === 'yearly') totalDays = 365;

                   percentRemaining = Math.min(100, Math.max(0, Math.round((daysRemaining / totalDays) * 100)));
                 } else if (planId === 'free') {
                   percentRemaining = 100;
                 }

                 return (
                   <>
                     <div className="flex justify-between items-center mb-3.5">
                       <h3 className="text-sm font-semibold text-[#1a1a1a]">Current role</h3>
                       <Briefcase className="w-4 h-4 text-[#888888]" />
                     </div>
                     <div className="flex flex-wrap gap-2.5">
                        <span className="text-xs font-bold bg-[#f7f5f2] text-[#444444] px-3.5 py-1.5 rounded-full border border-black/5">Personal</span>
                        <span className="text-xs font-bold bg-[#f7f5f2] text-[#444444] px-3.5 py-1.5 rounded-full border border-black/5">{planLabel}</span>
                        <span className="text-xs font-bold bg-[#f7f5f2] text-[#444444] px-3.5 py-1.5 rounded-full border border-black/5">India</span>
                        <span className="text-xs font-bold bg-[#f7f5f2] text-[#444444] px-3.5 py-1.5 rounded-full border border-black/5">Premium</span>
                     </div>

                     <div className="mt-6 bg-[#f7f5f2] rounded-xl p-5 border border-black/5">
                       <div className="flex justify-between items-center mb-4">
                         <h3 className="text-[11px] font-bold text-[#1a1a1a] flex items-center gap-2 uppercase tracking-wider">
                            <span className="w-5 h-5 rounded flex items-center justify-center bg-white text-emerald-700 text-xs shadow-sm">👑</span> 
                            SUBSCRIPTION TIMELINE
                         </h3>
                         <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${planStatus === 'active' ? 'text-emerald-700 bg-emerald-100' : 'text-amber-700 bg-amber-100'}`}>
                           {planStatus}
                         </span>
                       </div>
                       <p className="font-bold text-[#1a1a1a] text-lg">{planLabel}</p>
                       <p className="text-[12px] text-[#666666] font-medium mt-1">
                         {isForever ? 'Forever' : `${daysRemaining} days remaining`}
                       </p>
                       <div className="w-full bg-black/10 rounded-full h-1.5 mt-4 overflow-hidden">
                         <div 
                           className="bg-[#0f3d32] h-1.5 rounded-full transition-all duration-500" 
                           style={{ width: `${percentRemaining}%` }}
                         ></div>
                       </div>
                     </div>
                   </>
                 );
               })()}
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
               <button className="bg-[#f7f5f2] hover:bg-[#efedea] transition-colors rounded-xl p-3 flex flex-col justify-between items-start text-left group border border-black/5">
                  <div className="flex justify-between items-center w-full mb-1.5">
                     <span className="text-[11px] font-bold text-[#1a1a1a] leading-tight">Ready for work</span>
                     <ChevronRight className="w-3 h-3 text-[#888888] group-hover:text-[#1a1a1a]" />
                  </div>
                  <span className="text-[10px] text-[#666666] font-medium leading-relaxed mt-1">Premium tools are active.</span>
               </button>
               <button className="bg-[#f7f5f2] hover:bg-[#efedea] transition-colors rounded-xl p-3 flex flex-col justify-between items-start text-left group border border-black/5">
                  <div className="flex justify-between items-center w-full mb-1.5">
                     <span className="text-[11px] font-bold text-[#1a1a1a] leading-tight">Share profile</span>
                     <ChevronRight className="w-3 h-3 text-[#888888] group-hover:text-[#1a1a1a]" />
                  </div>
                  <span className="text-[10px] text-[#666666] font-medium leading-relaxed mt-1">Keep your account details complete.</span>
               </button>
               <button className="bg-[#f7f5f2] hover:bg-[#efedea] transition-colors rounded-xl p-3 flex flex-col justify-between items-start text-left group border border-black/5">
                  <div className="flex justify-between items-center w-full mb-1.5">
                     <span className="text-[11px] font-bold text-[#1a1a1a] leading-tight">Update</span>
                     <ChevronRight className="w-3 h-3 text-[#888888] group-hover:text-[#1a1a1a]" />
                  </div>
                  <span className="text-[10px] text-[#666666] font-medium leading-relaxed mt-1">Refresh billing and security details.</span>
               </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column Detailed Forms */}
      <div className="flex-1 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-black/10 p-6 md:p-8 xl:p-10 h-full">
          <div className="flex items-center gap-2 mb-8 text-[#1a1a1a]">
            <UserRound className="w-5 h-5" />
            <h2 className="text-xl font-bold">Personal Information</h2>
          </div>

          <div className="flex flex-col lg:flex-row gap-12 xl:gap-16">
            {/* Profile Information */}
            <div className="flex-1 space-y-8">
              <div>
                <h3 className="text-lg font-bold text-[#1a1a1a] mb-1.5">Profile Information</h3>
                <p className="text-[14px] text-[#666666] leading-relaxed">Manage your profile details and personalize your account.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-[#444444]">Full Name</Label>
                  <div className="relative">
                    <UserRound className="absolute left-3.5 top-3 h-4 w-4 text-[#888888]" />
                    <Input defaultValue={user?.name || 'Getaipilot'} className="pl-10 h-10 border-black/10 focus-visible:ring-[#0f3d32] text-[14px] rounded-lg bg-white shadow-sm" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-[#444444]">Primary Interest</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3.5 top-3 h-4 w-4 text-[#888888]" />
                    <Input defaultValue="Musicians" className="pl-10 h-10 border-black/10 focus-visible:ring-[#0f3d32] text-[14px] rounded-lg bg-white shadow-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-[#444444]">Country</Label>
                    <div className="relative">
                      <Globe className="absolute left-2 top-3 h-4 w-4 text-[#888888]" />
                      <Input defaultValue="India" className="pl-7 pr-1 h-10 border-black/10 focus-visible:ring-[#0f3d32] text-[12px] rounded-lg bg-white shadow-sm" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-[#444444]">State</Label>
                    <div className="relative">
                      <MapPin className="absolute left-2 top-3 h-4 w-4 text-[#888888]" />
                      <Input defaultValue="Madhya P." className="pl-7 pr-1 h-10 border-black/10 focus-visible:ring-[#0f3d32] text-[12px] rounded-lg bg-white shadow-sm" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-[#444444]">City</Label>
                    <div className="relative">
                      <MapPin className="absolute left-2 top-3 h-4 w-4 text-[#888888]" />
                      <Input defaultValue="Bhopal" className="pl-7 pr-1 h-10 border-black/10 focus-visible:ring-[#0f3d32] text-[12px] rounded-lg bg-white shadow-sm" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="flex-1 space-y-8">
              <div>
                <h3 className="text-lg font-bold text-[#1a1a1a] mb-1.5">Contact Information</h3>
                <p className="text-[14px] text-[#666666] leading-relaxed">Keep your account accessible and secure.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold text-[#444444]">Email Address</Label>
                      <span className="text-[10px] font-bold bg-[#f7f5f2] text-[#666666] px-2 py-0.5 rounded border border-black/5 uppercase tracking-widest">Read Only</span>
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#888888]" />
                    <Input defaultValue={user?.email || 'getaipilott@gmail.com'} readOnly className="pl-10 h-10 bg-[#f7f5f2] text-[#666666] border-black/10 cursor-not-allowed shadow-none text-[14px] rounded-lg" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-[#444444]">Mobile Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3 h-4 w-4 text-[#888888]" />
                    <Input defaultValue="+917828876750" className="pl-10 h-10 border-black/10 focus-visible:ring-[#0f3d32] text-[14px] rounded-lg bg-white shadow-sm" />
                  </div>
                </div>

                <div className="space-y-4 pt-1">
                  <div className="flex items-center gap-2 mb-2">
                      <Label className="text-xs font-bold text-[#444444]">Social Presence</Label>
                      <span className="text-[10px] font-bold border border-black/10 text-[#666666] px-2 py-0.5 rounded uppercase tracking-widest">Optional</span>
                  </div>
                  
                  <div className="relative">
                    <Instagram className="absolute left-3.5 top-3 h-4 w-4 text-[#888888]" />
                    <Input placeholder="Instagram URL" className="pl-10 h-10 border-black/10 focus-visible:ring-[#0f3d32] text-[14px] rounded-lg bg-white shadow-sm" />
                  </div>
                  <div className="relative">
                    <Facebook className="absolute left-3.5 top-3 h-4 w-4 text-[#888888]" />
                    <Input placeholder="Facebook URL" className="pl-10 h-10 border-black/10 focus-visible:ring-[#0f3d32] text-[14px] rounded-lg bg-white shadow-sm" />
                  </div>
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-3 h-4 w-4 text-[#888888]" />
                    <Input placeholder="Website URL" className="pl-10 h-10 border-black/10 focus-visible:ring-[#0f3d32] text-[14px] rounded-lg bg-white shadow-sm" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const autoDM = useAutoDM();
  const [activeTab, setActiveTab] = useState('account');

  return (
    <div className="w-full max-w-full px-5 md:px-8 xl:px-12 py-8">
      <div className="relative flex justify-between items-end mb-8">
        <div>
          <h3 className="text-[10px] font-bold text-[#888888] uppercase tracking-[0.2em] mb-1.5">Account Center</h3>
          <h1 className="text-[28px] font-bold text-[#1a1a1a] tracking-tight leading-tight">Profile Settings</h1>
        </div>
        {activeTab === 'platforms' ? (
          <video
            className="pointer-events-none absolute -top-20 right-0 hidden h-[270px] w-[440px] object-contain lg:block"
            src="/icons/Account_Connect_Page.webm"
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
          />
        ) : null}
      </div>

      <div className="w-full border-b border-black/10 mb-6">
        <div className="flex items-center gap-8 -mb-[1px] overflow-x-auto no-scrollbar">
           <button 
              className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-[3px] flex items-center gap-2 whitespace-nowrap ${activeTab === 'account' ? 'border-[#0f3d32] text-[#0f3d32]' : 'border-transparent text-[#888888] hover:text-[#1a1a1a]'}`}
              onClick={() => setActiveTab('account')}
           >
              <UserRound className="w-[15px] h-[15px]" />
              Profile Details
           </button>
           <button 
              className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-[3px] flex items-center gap-2 whitespace-nowrap ${activeTab === 'platforms' ? 'border-[#0f3d32] text-[#0f3d32]' : 'border-transparent text-[#888888] hover:text-[#1a1a1a]'}`}
              onClick={() => setActiveTab('platforms')}
           >
              <Shield className="w-[15px] h-[15px]" />
              Connected Accounts
           </button>
           <button 
              className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-[3px] flex items-center gap-2 whitespace-nowrap ${activeTab === 'billing' ? 'border-[#0f3d32] text-[#0f3d32]' : 'border-transparent text-[#888888] hover:text-[#1a1a1a]'}`}
              onClick={() => setActiveTab('billing')}
           >
              <CreditCard className="w-[15px] h-[15px]" />
              Plan & Billing
           </button>
        </div>
      </div>

      <div className="mt-4">
        {activeTab === 'platforms' ? <ConnectedPlatformsPanel autoDMState={autoDM} showBillingSummary /> : null}
        {activeTab === 'account' ? <ProfileSettingsPanel user={user} /> : null}
        {activeTab === 'billing' ? <BillingPage embedded /> : null}
      </div>
    </div>
  );
}
