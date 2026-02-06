import React from 'react';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { 
  Activity, 
  BarChart3, 
  Layers, 
  ChevronRight, 
  Database,
  Search
} from 'lucide-react';

export default async function DashboardHUD() {
  const posts = await prisma.post.findMany({
    include: {
      metricsSnapshots: {
        orderBy: { captured_at: 'desc' },
        take: 1,
      },
    },
    orderBy: { created_at: 'desc' },
  });

  const totalPosts = posts.length;
  const totalImpressions = posts.reduce((sum, post) => sum + (post.metricsSnapshots[0]?.impression_count || 0), 0);
  const avgEngagement = posts.length > 0 
    ? (posts.reduce((sum, post) => sum + (post.metricsSnapshots[0]?.engagement_rate || 0), 0) / posts.length).toFixed(2)
    : 0;

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-outfit selection:bg-[#4fb7a0]/30">
      
      {/* HUD Header */}
      <div className="max-w-7xl mx-auto py-10 px-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-[#2a2c31] pb-12 mb-12">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#4fb7a0] animate-pulse shadow-[0_0_10px_#4fb7a0]"></div>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#70757a]">Digital Twin Active</span>
            </div>
            <h1 className="text-7xl font-black italic tracking-tighter text-white uppercase leading-none">
              POST_<span className="text-[#4fb7a0]">CORE</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/import" className="flex items-center gap-2 bg-[#0f1012] border border-[#2a2c31] hover:border-[#4fb7a0]/50 text-white font-bold px-6 py-3 rounded-lg uppercase tracking-widest text-xs transition-all active:scale-95">
              <Database size={16} className="text-[#4fb7a0]" />
              Neural Ingest
            </Link>
          </div>
        </header>

        {/* Global Metrics HUD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            { label: 'Total Output', value: totalPosts, unit: 'POSTS', icon: Layers, color: 'text-white' },
            { label: 'Network Reach', value: totalImpressions.toLocaleString(), unit: 'IMPRESSIONS', icon: BarChart3, color: 'text-[#4fb7a0]' },
            { label: 'Neural Bond', value: `${avgEngagement}%`, unit: 'ENGAGEMENT', icon: Activity, color: 'text-[#ffb700]' },
          ].map((stat, i) => (
            <div key={i} className="bg-[#0f1012] border border-[#2a2c31] p-10 rounded-2xl shadow-2xl relative group overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[#4fb7a0] translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[#70757a]">{stat.label}</span>
                <stat.icon size={22} className="text-[#2a2c31] group-hover:text-[#4fb7a0] transition-all duration-300" />
              </div>
              <div className="flex items-baseline gap-3">
                <div className={`text-6xl font-black italic tracking-tighter ${stat.color}`}>{stat.value}</div>
                <span className="text-[10px] font-bold text-[#444] tracking-widest">{stat.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tactical Feed */}
        <div className="space-y-8">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-[#70757a]">Historical Data stream</h3>
            <div className="flex items-center gap-2 text-[10px] font-bold text-[#444]">
              <Search size={12} />
              <span>FILTERING DISABLED</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {posts.map((post) => {
              const metrics = post.metricsSnapshots[0];
              return (
                <div key={post.id} className="bg-[#0f1012] border border-[#2a2c31] p-8 rounded-2xl hover:border-[#4fb7a0]/20 transition-all group cursor-default">
                  <div className="flex flex-col lg:flex-row gap-8 items-start">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-4">
                        <span className="text-[9px] font-black bg-white/5 text-[#4fb7a0] px-3 py-1 rounded uppercase tracking-[0.2em] border border-white/10">
                          {post.format_tag || 'standard'}
                        </span>
                        <span className="text-[10px] font-mono text-[#444] uppercase tracking-widest">
                          {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-xl font-medium leading-relaxed text-[#d0d0d0] group-hover:text-white transition-colors">
                        {post.text}
                      </p>
                    </div>
                    
                    <div className="flex flex-row lg:flex-col items-center justify-between lg:justify-center gap-12 min-w-[180px] lg:border-l border-[#2a2c31] lg:pl-12 w-full lg:w-auto">
                      <div className="text-center space-y-1">
                        <div className="text-[9px] font-black text-[#444] uppercase tracking-[0.3em]">Viral Signal</div>
                        <div className="text-3xl font-black italic tracking-tighter text-white">
                          {metrics?.like_count || 0}
                          <span className="text-xs ml-1 not-italic font-bold text-[#444]">LKS</span>
                        </div>
                      </div>
                      <div className="text-center space-y-1">
                        <div className="text-[9px] font-black text-[#444] uppercase tracking-[0.3em]">Eff. Ratio</div>
                        <div className="text-3xl font-black italic tracking-tighter text-[#4fb7a0]">
                          {metrics?.engagement_rate || 0}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
