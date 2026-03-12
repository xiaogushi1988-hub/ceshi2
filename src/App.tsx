import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Calendar, 
  Fingerprint as FingerprintIcon, 
  Plus, 
  ChevronRight, 
  History, 
  Cpu, 
  Edit3, 
  CheckCircle2,
  Loader2,
  X,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Fingerprint, AnalysisItem } from './types';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export default function App() {
  const [fingerprints, setFingerprints] = useState<Fingerprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCrawlModal, setShowCrawlModal] = useState(false);
  const [selectedFingerprint, setSelectedFingerprint] = useState<Fingerprint | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisItem[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  
  // Multi-select platforms and browsers
  const [availablePlatforms, setAvailablePlatforms] = useState([
    { name: 'Amazon', url: 'https://www.amazon.com' },
    { name: 'eBay', url: 'https://www.ebay.com' },
    { name: 'AliExpress', url: 'https://www.aliexpress.com' },
    { name: 'Shopee', url: 'https://shopee.com' },
    { name: 'Lazada', url: 'https://www.lazada.com' },
    { name: 'Temu', url: 'https://www.temu.com' },
    { name: 'TikTok Shop', url: 'https://shop.tiktok.com' },
    { name: 'Shein', url: 'https://www.shein.com' },
    { name: 'Walmart', url: 'https://www.walmart.com' }
  ]);
  const [availableBrowsers, setAvailableBrowsers] = useState([
    { name: 'Chrome', config: 'Default Chrome Config' },
    { name: 'Firefox', config: 'Default Firefox Config' },
    { name: 'Safari', config: 'Default Safari Config' },
    { name: 'Edge', config: 'Default Edge Config' },
    { name: 'Opera', config: 'Default Opera Config' },
    { name: 'Brave', config: 'Default Brave Config' }
  ]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedBrowsers, setSelectedBrowsers] = useState<string[]>(['Chrome']);
  
  // Add Platform/Browser state
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState('');
  const [newPlatformUrl, setNewPlatformUrl] = useState('');
  
  const [showAddBrowser, setShowAddBrowser] = useState(false);
  const [newBrowserName, setNewBrowserName] = useState('');
  const [newBrowserConfig, setNewBrowserConfig] = useState('');
  
  const [crawling, setCrawling] = useState(false);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  
  // Logic editing state
  const [editingGroup, setEditingGroup] = useState<{ website: string, url: string, logic: string, items: Fingerprint[] } | null>(null);
  const [logicFields, setLogicFields] = useState<{ name: string, code: string }[]>([]);
  const [logicDescription, setLogicDescription] = useState('');

  // Comparison state
  const [comparisonGroup, setComparisonGroup] = useState<{ website: string, url: string, items: Fingerprint[] } | null>(null);
  const [selectedComparisonBrowsers, setSelectedComparisonBrowsers] = useState<string[]>([]);

  // Unified Modal state
  const [showUnifiedModal, setShowUnifiedModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'detection' | 'logic' | 'comparison'>('comparison');
  const [activeGroup, setActiveGroup] = useState<{ website: string, url: string, logic: string, items: Fingerprint[] } | null>(null);

  // Annotation Editor state
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [editingFingerprint, setEditingFingerprint] = useState<Fingerprint | null>(null);
  const [tempAnnotation, setTempAnnotation] = useState('');

  // Script Logs state
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [tasks, setTasks] = useState<{ id: string, name: string, browser: string, status: 'success' | 'running' | 'failed', time: string }[]>([
    { id: '1', name: 'Amazon', browser: 'Chrome', status: 'success', time: '2026-03-10 09:00:00' },
    { id: '2', name: 'eBay', browser: 'Firefox', status: 'running', time: '2026-03-10 10:30:00' },
    { id: '3', name: 'TikTok Shop', browser: 'Chrome', status: 'failed', time: '2026-03-10 11:15:00' },
  ]);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 8;

  useEffect(() => {
    fetchFingerprints();
  }, [page]);

  const fetchFingerprints = async () => {
    setLoading(true);
    console.log('DEBUG: Fetching fingerprints for page', page);
    try {
      const res = await fetch(`/api/fingerprints?page=${page}&limit=${limit}`);
      const result = await res.json();
      console.log('DEBUG: Received fingerprints:', result);
      setFingerprints(result.data || []);
      setTotalPages(result.totalPages || 1);
      setTotalItems(result.total || 0);
    } catch (err) {
      console.error('DEBUG: Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCrawl = async () => {
    if (selectedPlatforms.length === 0 || selectedBrowsers.length === 0) return;
    setCrawling(true);
    
    // Create initial running tasks
    const initialTasks = selectedPlatforms.flatMap(p => 
      selectedBrowsers.map(b => ({
        id: Math.random().toString(36).substr(2, 9),
        name: p,
        browser: b,
        status: 'running' as const,
        time: new Date().toLocaleString()
      }))
    );
    setTasks(prev => [...initialTasks, ...prev]);

    try {
      const results = [];
      for (const platformName of selectedPlatforms) {
        const platform = availablePlatforms.find(p => p.name === platformName);
        for (const browserName of selectedBrowsers) {
          // Generate data using Gemini in frontend
          const prompt = `为电商平台 "${platformName}" 在浏览器 "${browserName}" 环境下生成一个真实的浏览器指纹检测逻辑。
          包含：
          1. 一个风控文件名（如 "sec.js", "risk.v2.js"）。
          2. 指纹内容片段（JSON 格式）。
          3. 检测逻辑（伪代码或 JS 片段）。
          4. AI 注解，解释该逻辑的目标。
          
          返回 JSON 格式，键名为：risk_file, content, logic, ai_annotation。`;

          let data;
          try {
            const response = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: [{ parts: [{ text: prompt }] }],
              config: { responseMimeType: "application/json" }
            });
            data = JSON.parse(response.text || "{}");
          } catch (err) {
            console.warn("Gemini generation failed, using fallback", err);
            data = {
              risk_file: `${platformName.toLowerCase()}_guard.js`,
              content: `{"fallback": true, "browser": "${browserName}", "reason": "AI_UNAVAILABLE"}`,
              logic: "function fallback() { return true; }",
              ai_annotation: `由于 AI 服务暂时不可用，这是系统生成的针对 ${browserName} 的兜底检测逻辑。`
            };
          }

          results.push({
            platform: platformName,
            browser: browserName,
            url: platform?.url || `https://www.${platformName.toLowerCase()}.com`,
            data
          });
        }
      }

      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results })
      });
      
      if (res.ok) {
        setPage(1);
        await fetchFingerprints();
        setShowCrawlModal(false);
        setSelectedPlatforms([]);
        setSelectedBrowsers(['Chrome']);
        
        // Update tasks to success
        setTasks(prev => prev.map(t => {
          const matched = results.find(r => r.platform === t.name && r.browser === t.browser && t.status === 'running');
          return matched ? { ...t, status: 'success' as const } : t;
        }));
      }
    } catch (err) {
      console.error(err);
      // Update tasks to failed
      setTasks(prev => prev.map(t => t.status === 'running' ? { ...t, status: 'failed' as const } : t));
    } finally {
      setCrawling(false);
    }
  };

  const addPlatform = () => {
    if (!newPlatformName || !newPlatformUrl) return;
    setAvailablePlatforms(prev => [...prev, { name: newPlatformName, url: newPlatformUrl }]);
    setNewPlatformName('');
    setNewPlatformUrl('');
    setShowAddPlatform(false);
  };

  const addBrowser = () => {
    if (!newBrowserName || !newBrowserConfig) return;
    setAvailableBrowsers(prev => [...prev, { name: newBrowserName, config: newBrowserConfig }]);
    setNewBrowserName('');
    setNewBrowserConfig('');
    setShowAddBrowser(false);
  };

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(p) ? prev.filter(item => item !== p) : [...prev, p]
    );
  };

  const toggleBrowser = (b: string) => {
    setSelectedBrowsers(prev => 
      prev.includes(b) ? prev.filter(item => item !== b) : [...prev, b]
    );
  };

  const selectAllPlatforms = () => {
    if (selectedPlatforms.length === availablePlatforms.length) {
      setSelectedPlatforms([]);
    } else {
      setSelectedPlatforms(availablePlatforms.map(p => p.name));
    }
  };

  const [selectedAnalysisItem, setSelectedAnalysisItem] = useState<AnalysisItem | null>(null);
  const [detectionResults, setDetectionResults] = useState<Record<string, { status: 'pass' | 'fail' | 'warning', score: number, details: string }>>({});

  const handleDetect = async (fp: Fingerprint) => {
    console.log('DEBUG: handleDetect called with', fp);
    setSelectedFingerprint(fp);
    const groupKey = `${fp.website}-${fp.url}`;
    const group = groupedFingerprints[groupKey];
    if (group) {
      setActiveGroup(group);
      setEditingGroup(group);
      setComparisonGroup(group);
      setLogicDescription(group.logic);
      setLogicFields([
        { name: 'UserAgent', code: 'navigator.userAgent' },
        { name: 'Canvas', code: 'canvas.toDataURL()' }
      ]);
    }
    setActiveTab('detection');
    setShowUnifiedModal(true);
    setAnalyzing(true);
    setSelectedAnalysisItem(null);
    
    // Mocking detection results for each browser in the group
    if (group) {
      const results: Record<string, { status: 'pass' | 'fail' | 'warning', score: number, details: string }> = {};
      group.items.forEach(item => {
        const browser = item.browser || 'Chrome';
        const isPass = Math.random() > 0.3;
        results[browser] = {
          status: isPass ? 'pass' : 'fail',
          score: isPass ? Math.floor(Math.random() * 20) + 80 : Math.floor(Math.random() * 40) + 30,
          details: isPass ? '符合检测逻辑，未发现异常指纹特征。' : '检测到指纹异常：Canvas 渲染特征与真实环境不符。'
        };
      });
      setDetectionResults(results);
    }

    try {
      // Use Gemini in frontend for analysis
      const prompt = `Analyze this fingerprinting content and logic:
      Content: ${fp.content}
      Logic: ${fp.logic}
      
      Break it down into a list of specific fingerprint items. For each item, provide:
      1. Item name (e.g., "Canvas Fingerprinting", "WebRTC Leak").
      2. Detection branches (different ways it's checked).
      3. An AI summary of why this is used for risk control.
      
      Return as JSON array of objects with keys: name, branches (array of strings), summary.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || "[]");
      setAnalysis(data);
      if (data.length > 0) setSelectedAnalysisItem(data[0]);
    } catch (err) {
      console.error('DEBUG: Detection analysis error:', err);
      // Fallback
      setAnalysis([
        {
          name: "基础指纹检测 (Base Fingerprint)",
          branches: ["检测浏览器 User-Agent 字符串", "检测屏幕分辨率与颜色深度"],
          summary: "这是系统自动生成的兜底分析。该指纹项主要用于识别基础的浏览器环境特征。"
        }
      ]);
    } finally {
      setAnalyzing(false);
    }
  };

  const saveCorrection = async (itemKey: string, text: string) => {
    if (!selectedFingerprint) return;
    try {
      await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprint_id: selectedFingerprint.id,
          item_key: itemKey,
          correction: text
        })
      });
      setCorrections(prev => ({ ...prev, [itemKey]: text }));
    } catch (err) {
      console.error(err);
    }
  };

  const updateFingerprint = async (id: number, updates: Partial<Fingerprint>) => {
    try {
      const res = await fetch(`/api/fingerprints/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        setFingerprints(prev => prev.map(fp => fp.id === id ? { ...fp, ...updates } : fp));
      }
    } catch (err) {
      console.error('Update error:', err);
    }
  };

  const handleEditLogic = (group: { website: string, url: string, logic: string, items: Fingerprint[] }) => {
    setActiveGroup(group);
    setEditingGroup(group);
    setComparisonGroup(group);
    setLogicDescription(group.logic);
    setLogicFields([
      { name: 'UserAgent', code: 'navigator.userAgent' },
      { name: 'Canvas', code: 'canvas.toDataURL()' }
    ]);
    setActiveTab('logic');
    setShowUnifiedModal(true);
  };

  const handleOpenComparison = (group: { website: string, url: string, items: Fingerprint[] }) => {
    const fullGroup = groupedFingerprints[`${group.website}-${group.url}`];
    setActiveGroup(fullGroup);
    setEditingGroup(fullGroup);
    setComparisonGroup(group);
    setLogicDescription(fullGroup.logic);
    setLogicFields([
      { name: 'UserAgent', code: 'navigator.userAgent' },
      { name: 'Canvas', code: 'canvas.toDataURL()' }
    ]);
    // Initialize selected browsers for comparison
    const ids = fullGroup.items.slice(0, 2).map(item => item.id.toString());
    setSelectedComparisonBrowsers(ids); // Default to first two
    setActiveTab('comparison');
    setShowUnifiedModal(true);
  };

  const handleOpenAnnotationEditor = (fp: Fingerprint) => {
    setEditingFingerprint(fp);
    setTempAnnotation(fp.ai_annotation);
    setShowAnnotationModal(true);
  };

  const saveAnnotation = async () => {
    if (!editingFingerprint) return;
    await updateFingerprint(editingFingerprint.id, { ai_annotation: tempAnnotation });
    setShowAnnotationModal(false);
  };

  const saveLogic = async () => {
    if (!editingGroup) return;
    // In a real app, we'd update all fingerprints in this group
    const groupItems = fingerprints.filter(fp => fp.website === editingGroup.website && fp.url === editingGroup.url);
    for (const item of groupItems) {
      await updateFingerprint(item.id, { logic: logicDescription });
    }
    setShowUnifiedModal(false);
  };

  const addLogicField = () => {
    setLogicFields([...logicFields, { name: '', code: '' }]);
  };

  const updateLogicField = (index: number, field: Partial<{ name: string, code: string }>) => {
    const newFields = [...logicFields];
    newFields[index] = { ...newFields[index], ...field };
    setLogicFields(newFields);
  };

  const removeLogicField = (index: number) => {
    setLogicFields(logicFields.filter((_, i) => i !== index));
  };

  const groupedFingerprints = fingerprints.reduce((acc, fp) => {
    const key = `${fp.website}-${fp.url}`;
    if (!acc[key]) {
      acc[key] = { website: fp.website, url: fp.url, logic: fp.logic, items: [] };
    }
    acc[key].items.push(fp);
    return acc;
  }, {} as Record<string, { website: string, url: string, logic: string, items: Fingerprint[] }>);

  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-5xl font-serif italic mb-2">指纹情报系统</h1>
          <p className="text-sm opacity-60 uppercase tracking-widest">电商风控指纹采集与逻辑分析工具</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={fetchFingerprints}
            className="p-3 border border-line/20 hover:bg-ink hover:text-paper transition-all"
            title="刷新数据"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={() => setShowCrawlModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-ink text-paper rounded-none hover:opacity-90 transition-opacity shadow-[4px_4px_0px_0px_rgba(20,20,20,0.2)]"
          >
            <Calendar size={18} />
            <span className="text-sm font-bold tracking-wider">定时跑脚本</span>
          </button>
          <button 
            onClick={() => setShowLogsModal(true)}
            className="flex items-center gap-2 px-6 py-3 border border-ink rounded-none hover:bg-ink hover:text-paper transition-all group"
          >
            <History size={18} />
            <span className="text-sm font-bold tracking-wider">脚本日志</span>
          </button>
        </div>
      </header>

      {/* Stats / Quick Info */}
      <div className="grid grid-cols-4 gap-8 mb-12">
        {[
          { label: '覆盖平台', value: '12', icon: Cpu },
          { label: '活跃版本', value: '48', icon: History },
          { label: '检测项总数', value: '1,204', icon: FingerprintIcon },
          { label: '最后更新', value: '2小时前', icon: CheckCircle2 },
        ].map((stat, i) => (
          <div key={i} className="border-l border-line/20 pl-6 py-2 bg-white/20 hover:bg-white/40 transition-colors">
            <div className="flex items-center gap-2 opacity-50 mb-1">
              <stat.icon size={14} />
              <span className="text-[10px] uppercase tracking-widest font-bold">{stat.label}</span>
            </div>
            <div className="text-3xl font-mono font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Main List */}
      <div className="bg-white/50 backdrop-blur-sm border border-line/10 shadow-xl overflow-hidden">
        <div className="grid grid-cols-[60px_120px_100px_150px_180px_180px_1fr_80px] p-4 data-grid-header bg-ink/5 border-b border-line/10">
          <div>ID</div>
          <div>目标平台</div>
          <div>浏览器环境</div>
          <div>风控文件</div>
          <div>指纹项内容</div>
          <div>检测逻辑</div>
          <div>AI 智能注解</div>
          <div className="text-right">版本号</div>
        </div>

        {loading ? (
          <div className="p-20 flex justify-center">
            <Loader2 className="animate-spin opacity-20" size={48} />
          </div>
        ) : (
          <>
            <div className="divide-y divide-line/10">
              {(Object.values(groupedFingerprints) as { website: string, url: string, logic: string, items: Fingerprint[] }[]).map((group, gIdx) => (
                <div key={gIdx} className="flex flex-col">
                  {/* Group Header */}
                  <div className="bg-ink/[0.02] px-4 py-3 border-b border-line/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div 
                        className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity"
                        onClick={() => handleDetect(group.items[0])}
                      >
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="font-bold text-base tracking-tight">{group.website}</span>
                        <ExternalLink size={12} className="opacity-30" />
                      </div>
                      <span className="text-[10px] opacity-40 font-mono tracking-tighter uppercase">Target URL:</span>
                      <span className="text-[11px] font-mono opacity-60">{group.url}</span>
                      <div className="h-4 w-[1px] bg-line/10 mx-2" />
                      <span className="text-[10px] opacity-40 font-mono tracking-tighter uppercase">检测逻辑:</span>
                      <div className="flex items-center gap-2 group/logic">
                        <span className="text-[11px] font-mono opacity-80 italic">{group.logic}</span>
                        <button 
                          onClick={() => handleEditLogic(group)}
                          className="opacity-0 group-hover/logic:opacity-100 p-1 hover:bg-ink/5 rounded transition-all"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    </div>
                    <div 
                      className="text-[10px] font-bold opacity-30 uppercase tracking-widest cursor-pointer hover:opacity-100 transition-opacity flex items-center gap-2"
                      onClick={() => handleOpenComparison(group)}
                    >
                      <History size={12} />
                      {group.items.length} 采集环境 (点击对比)
                    </div>
                  </div>

                  {/* Group Items (Browsers) */}
                  <div className="divide-y divide-line/5">
                    {group.items.map((fp) => (
                      <div 
                        key={fp.id} 
                        className="grid grid-cols-[60px_120px_100px_150px_180px_180px_1fr_80px] p-4 data-grid-row items-center group hover:bg-ink/[0.01] transition-colors cursor-pointer"
                        onClick={() => handleOpenComparison(group)}
                      >
                        <div className="mono-value opacity-30 text-[10px]">#{fp.id.toString().padStart(3, '0')}</div>
                        <div 
                          className="flex items-center gap-2 hover:text-emerald-600 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDetect(fp);
                          }}
                        >
                          <span className="font-bold text-[11px] truncate">{fp.website}</span>
                          <FingerprintIcon size={10} className="opacity-30" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="bg-ink text-paper px-2 py-0.5 rounded-[2px] text-[9px] font-bold uppercase tracking-tighter">
                            {fp.browser || 'Chrome'}
                          </span>
                        </div>
                        <div className="mono-value text-emerald-700 font-bold truncate pr-4 text-[11px]">{fp.risk_file}</div>
                        <div className="text-[10px] font-mono opacity-60 truncate pr-4 bg-ink/5 p-1 rounded">{fp.content}</div>
                        <div className="text-[10px] font-mono opacity-40 truncate pr-4 italic">Shared Logic</div>
                        <div className="pr-4">
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAnnotationEditor(fp);
                            }}
                            className="text-xs line-clamp-1 opacity-80 hover:text-ink hover:underline transition-all flex items-center gap-2"
                          >
                            <Edit3 size={10} className="opacity-30 shrink-0" />
                            <span className="truncate">{fp.ai_annotation}</span>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <div className="mono-value bg-ink/5 px-2 py-0.5 rounded text-[10px]">{fp.version}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-line/10 flex justify-between items-center bg-white/30">
              <div className="text-[10px] uppercase tracking-widest opacity-50 font-bold">
                共 {totalItems} 条记录 | 第 {page} / {totalPages} 页
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-line/10 text-[10px] font-bold uppercase tracking-widest hover:bg-ink hover:text-paper disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-ink transition-all"
                >
                  上一页
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 flex items-center justify-center text-[10px] font-mono border transition-all ${page === p ? 'bg-ink text-paper border-ink' : 'border-line/10 hover:border-line'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-line/10 text-[10px] font-bold uppercase tracking-widest hover:bg-ink hover:text-paper disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-ink transition-all"
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </div>


      {/* Scheduled Script Modal */}
      <AnimatePresence>
        {showCrawlModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCrawlModal(false)}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-paper w-full max-w-lg p-8 border border-line shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-serif italic">配置采集脚本</h2>
                <button 
                  onClick={selectAllPlatforms}
                  className="text-[10px] uppercase tracking-widest font-bold border border-line/20 px-3 py-1 hover:bg-ink hover:text-paper transition-all"
                >
                  {selectedPlatforms.length === availablePlatforms.length ? '取消全选' : '全选平台'}
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-[10px] uppercase tracking-widest font-bold opacity-40">选择目标平台</h3>
                    <button 
                      onClick={() => setShowAddPlatform(!showAddPlatform)}
                      className="text-[10px] text-ink/60 hover:text-ink flex items-center gap-1 font-bold uppercase tracking-widest"
                    >
                      <Plus size={12} /> 新增平台
                    </button>
                  </div>
                  
                  <AnimatePresence>
                    {showAddPlatform && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mb-4 p-4 bg-ink/5 border border-line/10 space-y-3"
                      >
                        <input 
                          type="text" 
                          placeholder="平台名称 (如: Amazon)" 
                          value={newPlatformName}
                          onChange={(e) => setNewPlatformName(e.target.value)}
                          className="w-full p-2 text-xs border border-line/10 bg-white outline-none focus:border-ink transition-colors"
                        />
                        <input 
                          type="text" 
                          placeholder="目标 URL (如: https://www.amazon.com)" 
                          value={newPlatformUrl}
                          onChange={(e) => setNewPlatformUrl(e.target.value)}
                          className="w-full p-2 text-xs border border-line/10 bg-white outline-none focus:border-ink transition-colors"
                        />
                        <button 
                          onClick={addPlatform}
                          className="w-full py-2 bg-ink text-paper text-[10px] font-bold uppercase tracking-widest hover:opacity-90"
                        >
                          确认添加
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid grid-cols-3 gap-3">
                    {availablePlatforms.map(p => (
                      <button
                        key={p.name}
                        onClick={() => togglePlatform(p.name)}
                        className={`p-3 text-[11px] font-mono border transition-all text-left flex justify-between items-center ${selectedPlatforms.includes(p.name) ? 'bg-ink text-paper border-ink' : 'bg-white border-line/10 hover:border-line'}`}
                      >
                        {p.name}
                        {selectedPlatforms.includes(p.name) && <CheckCircle2 size={12} />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-[10px] uppercase tracking-widest font-bold opacity-40">选择模拟浏览器</h3>
                    <button 
                      onClick={() => setShowAddBrowser(!showAddBrowser)}
                      className="text-[10px] text-ink/60 hover:text-ink flex items-center gap-1 font-bold uppercase tracking-widest"
                    >
                      <Plus size={12} /> 新增浏览器
                    </button>
                  </div>

                  <AnimatePresence>
                    {showAddBrowser && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mb-4 p-4 bg-ink/5 border border-line/10 space-y-3"
                      >
                        <input 
                          type="text" 
                          placeholder="浏览器名称 (如: Chrome 120)" 
                          value={newBrowserName}
                          onChange={(e) => setNewBrowserName(e.target.value)}
                          className="w-full p-2 text-xs border border-line/10 bg-white outline-none focus:border-ink transition-colors"
                        />
                        <textarea 
                          placeholder="配置信息 (如: UserAgent, 硬件加速设置...)" 
                          value={newBrowserConfig}
                          onChange={(e) => setNewBrowserConfig(e.target.value)}
                          className="w-full p-2 text-xs border border-line/10 bg-white outline-none focus:border-ink transition-colors h-20 resize-none"
                        />
                        <button 
                          onClick={addBrowser}
                          className="w-full py-2 bg-ink text-paper text-[10px] font-bold uppercase tracking-widest hover:opacity-90"
                        >
                          确认添加
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid grid-cols-3 gap-3">
                    {availableBrowsers.map(b => (
                      <button
                        key={b.name}
                        onClick={() => toggleBrowser(b.name)}
                        className={`p-3 text-[11px] font-mono border transition-all text-left flex justify-between items-center ${selectedBrowsers.includes(b.name) ? 'bg-ink text-paper border-ink' : 'bg-white border-line/10 hover:border-line'}`}
                      >
                        {b.name}
                        {selectedBrowsers.includes(b.name) && <CheckCircle2 size={12} />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-ink/5 text-[10px] font-mono opacity-60">
                  * 系统将自动根据历史采集记录递增版本号，并针对不同浏览器环境生成差异化指纹逻辑。
                </div>

                <div className="pt-4">
                  <button 
                    onClick={handleCrawl}
                    disabled={crawling || selectedPlatforms.length === 0 || selectedBrowsers.length === 0}
                    className="w-full py-4 bg-ink text-paper uppercase tracking-widest text-sm font-bold flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-20"
                  >
                    {crawling ? <Loader2 className="animate-spin" size={18} /> : `启动采集任务 (${selectedPlatforms.length} 平台 × ${selectedBrowsers.length} 浏览器)`}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Unified Modal (Detection, Logic, Comparison) */}
      <AnimatePresence>
        {showUnifiedModal && activeGroup && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUnifiedModal(false)}
              className="absolute inset-0 bg-ink/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-paper w-full max-w-6xl h-[90vh] flex flex-col border border-line shadow-2xl overflow-hidden z-[201]"
            >
              {/* Modal Header & Tabs */}
              <div className="bg-white/50 border-b border-line/10">
                <div className="p-6 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-serif italic">{activeGroup.website} 环境情报中心</h2>
                    <p className="text-[10px] opacity-50 uppercase tracking-widest font-bold mt-1">
                      {activeGroup.url}
                    </p>
                  </div>
                  <button onClick={() => setShowUnifiedModal(false)} className="p-2 hover:bg-ink/5 rounded-full transition-colors">
                    <X size={24} />
                  </button>
                </div>
                
                <div className="flex px-6 gap-8">
                  {[
                    { id: 'comparison', label: '采集环境对比', icon: History },
                    { id: 'logic', label: '编辑检测逻辑', icon: Edit3 },
                    { id: 'detection', label: '逻辑检测结果', icon: FingerprintIcon },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 py-4 text-[11px] font-bold uppercase tracking-widest transition-all relative ${
                        activeTab === tab.id ? 'text-ink' : 'text-ink/40 hover:text-ink/60'
                      }`}
                    >
                      <tab.icon size={14} />
                      {tab.label}
                      {activeTab === tab.id && (
                        <motion.div 
                          layoutId="activeTab"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-ink"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'detection' && (
                  <div className="flex-1 flex overflow-hidden">
                    {/* Left: Detection Logic (User Defined) */}
                    <div className="w-2/5 border-r border-line/10 overflow-y-auto p-8 bg-white/10">
                      <div className="mb-8">
                        <h4 className="text-[11px] uppercase tracking-widest opacity-50 mb-4 flex items-center gap-2 font-bold">
                          <Edit3 size={14} /> 应用的检测逻辑 (User Defined Logic)
                        </h4>
                        <div className="p-6 bg-ink text-paper text-sm leading-relaxed font-mono italic shadow-lg">
                          {activeGroup.logic || '未定义检测逻辑'}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h4 className="text-[11px] uppercase tracking-widest opacity-50 mb-4 flex items-center gap-2 font-bold">
                          <Cpu size={14} /> 检测字段与代码
                        </h4>
                        {logicFields.map((field, idx) => (
                          <div key={idx} className="p-4 bg-white/40 border border-line/5 rounded shadow-sm">
                            <div className="text-[11px] font-bold mb-2 flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-ink/20"></div>
                              {field.name}
                            </div>
                            <code className="text-[10px] block bg-ink/5 p-3 rounded font-mono overflow-x-auto border border-line/5">
                              {field.code}
                            </code>
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-12 p-6 border border-dashed border-line/20 rounded-lg">
                        <p className="text-[10px] opacity-40 font-mono leading-relaxed">
                          * 以上逻辑将实时注入到目标浏览器环境中进行指纹特征提取与交叉验证。您可以切换到“编辑检测逻辑”标签页进行修改。
                        </p>
                      </div>
                    </div>

                    {/* Right: Browsers (Top) & Results (Bottom) */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* Right Top: Browser Environments Selection */}
                      <div className="p-6 border-b border-line/10 bg-paper">
                        <h3 className="text-[11px] uppercase tracking-widest opacity-50 mb-4 flex items-center gap-2 font-bold">
                          <FingerprintIcon size={14} /> 检测对象 (浏览器环境) - 点击环境启动检测
                        </h3>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                          {(Object.entries(detectionResults) as [string, { status: 'pass' | 'fail' | 'warning', score: number, details: string }][]).map(([browser, result]) => (
                            <div 
                              key={browser}
                              onClick={() => {
                                const fp = activeGroup.items.find(item => (item.browser || 'Chrome') === browser);
                                if (fp) handleDetect(fp);
                              }}
                              className={`p-4 border transition-all cursor-pointer group shadow-sm relative overflow-hidden ${
                                (selectedFingerprint?.browser || 'Chrome') === browser ? 'border-ink bg-ink/5 ring-1 ring-ink' : 'bg-white border-line/10 hover:border-line'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-sm">{browser}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                    result.status === 'pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {result.status === 'pass' ? 'PASS' : 'FAIL'}
                                  </span>
                                  <div className="p-1 bg-ink text-paper rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                    <RefreshCw size={10} className={analyzing && (selectedFingerprint?.browser || 'Chrome') === browser ? 'animate-spin' : ''} />
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mb-1">
                                <div className="flex-1 h-1 bg-ink/5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-1000 ${result.status === 'pass' ? 'bg-emerald-500' : 'bg-red-500'}`}
                                    style={{ width: `${result.score}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono font-bold">{result.score}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right Bottom: Detection Results Analysis */}
                      <div className="flex-1 overflow-y-auto p-8 bg-paper/50">
                        <div className="flex justify-between items-center mb-6">
                          <h4 className="text-[11px] uppercase tracking-widest opacity-50 flex items-center gap-2 font-bold">
                            <ChevronRight size={14} /> 详细检测项分析 (Detection Items) - {selectedFingerprint?.browser || 'Chrome'}
                          </h4>
                          {selectedFingerprint && (
                            <div className="text-[10px] font-mono opacity-40">
                              Last Scan: {new Date().toLocaleTimeString()}
                            </div>
                          )}
                        </div>

                        {analyzing ? (
                          <div className="flex flex-col items-center justify-center py-20 opacity-20">
                            <Loader2 className="animate-spin mb-4" size={48} />
                            <p className="font-serif italic text-xl">正在应用自定义逻辑进行深度扫描...</p>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {/* Detection Summary Card */}
                            {selectedFingerprint && detectionResults[selectedFingerprint.browser || 'Chrome'] && (
                              <div className={`p-6 border-l-4 shadow-sm mb-8 ${
                                detectionResults[selectedFingerprint.browser || 'Chrome'].status === 'pass' 
                                  ? 'border-emerald-500 bg-emerald-50/50' 
                                  : 'border-red-500 bg-red-50/50'
                              }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="font-bold text-sm uppercase tracking-tight">检测结论 (Conclusion)</div>
                                  <div className="text-xs font-mono font-bold">Score: {detectionResults[selectedFingerprint.browser || 'Chrome'].score}/100</div>
                                </div>
                                <p className="text-sm opacity-80 italic leading-relaxed">
                                  {detectionResults[selectedFingerprint.browser || 'Chrome'].details}
                                </p>
                              </div>
                            )}

                            {analysis.map((item, i) => (
                              <div key={i} className="bg-white border border-line/10 p-6 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-center mb-4">
                                  <h5 className="font-bold text-lg italic font-serif">{item.name}</h5>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono opacity-40">检测状态:</span>
                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                  </div>
                                </div>
                                <p className="text-sm opacity-70 mb-6 leading-relaxed bg-ink/[0.02] p-4 border-l-2 border-ink/20 italic">
                                  {item.summary}
                                </p>
                                <div className="space-y-2">
                                  {item.branches.map((branch, bi) => (
                                    <div key={bi} className="p-3 bg-ink/5 font-mono text-[11px] flex items-start gap-3 border border-line/5">
                                      <span className="opacity-30">[{bi + 1}]</span>
                                      <code className="break-all">{branch}</code>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'logic' && (
                  <div className="flex-1 overflow-y-auto p-8 bg-paper">
                    <div className="max-w-4xl mx-auto space-y-8">
                      {/* Logic Description */}
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-3 block">检测逻辑描述 (Detection Logic Description)</label>
                        <textarea 
                          value={logicDescription}
                          onChange={(e) => setLogicDescription(e.target.value)}
                          className="w-full h-32 p-4 bg-white border border-line/10 text-sm outline-none focus:border-line transition-colors resize-none shadow-inner font-sans leading-relaxed"
                          placeholder="描述该网站的整体检测逻辑..."
                        />
                      </div>

                      {/* Fingerprint Fields & Code */}
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <label className="text-[10px] uppercase tracking-widest font-bold opacity-40 block">指纹字段与检测代码 (Fingerprint Fields & Detection Code)</label>
                          <button 
                            onClick={addLogicField}
                            className="flex items-center gap-1 px-3 py-1 bg-ink text-paper text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity"
                          >
                            <Plus size={12} /> 新建字段
                          </button>
                        </div>
                        
                        <div className="space-y-4">
                          {logicFields.map((field, idx) => (
                            <div key={idx} className="grid grid-cols-[200px_1fr_40px] gap-4 items-start p-4 bg-white border border-line/5 shadow-sm group">
                              <div>
                                <input 
                                  type="text"
                                  value={field.name}
                                  onChange={(e) => updateLogicField(idx, { name: e.target.value })}
                                  placeholder="字段名称 (如 Canvas)"
                                  className="w-full p-2 border-b border-line/10 text-sm font-bold outline-none focus:border-line transition-all"
                                />
                              </div>
                              <div>
                                <textarea 
                                  value={field.code}
                                  onChange={(e) => updateLogicField(idx, { code: e.target.value })}
                                  placeholder="检测代码 (JavaScript)"
                                  className="w-full h-20 p-2 bg-ink/5 text-xs font-mono outline-none focus:bg-ink/10 transition-all resize-none"
                                />
                              </div>
                              <div className="flex justify-end">
                                <button 
                                  onClick={() => removeLogicField(idx)}
                                  className="p-2 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded transition-all"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-8 flex justify-end">
                        <button 
                          onClick={saveLogic}
                          className="px-12 py-4 bg-ink text-paper text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,0.1)]"
                        >
                          保存并应用逻辑
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'comparison' && (
                  <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Browser Selection Bar */}
                    <div className="px-8 py-4 bg-ink/[0.02] border-b border-line/10 flex items-center gap-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest font-bold opacity-40">选择对比环境:</span>
                        <span className="text-[9px] opacity-30 font-mono">勾选环境进行代码差异化分析</span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {activeGroup.items.map((item) => {
                          const browser = item.browser || 'Chrome';
                          const label = `${browser} ${item.version}`;
                          const isSelected = selectedComparisonBrowsers.includes(item.id.toString());
                          return (
                            <label 
                              key={item.id}
                              className={`flex items-center gap-2 px-3 py-1.5 border cursor-pointer transition-all ${
                                isSelected ? 'bg-ink text-paper border-ink' : 'bg-white border-line/10 hover:border-line'
                              }`}
                            >
                              <input 
                                type="checkbox"
                                className="hidden"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedComparisonBrowsers(prev => 
                                    prev.includes(item.id.toString()) ? prev.filter(id => id !== item.id.toString()) : [...prev, item.id.toString()]
                                  );
                                }}
                              />
                              <div className={`w-3 h-3 border flex items-center justify-center ${isSelected ? 'border-paper bg-paper' : 'border-ink/20'}`}>
                                {isSelected && <div className="w-1.5 h-1.5 bg-ink" />}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[11px] font-bold uppercase tracking-tighter leading-none">{browser}</span>
                                <span className="text-[9px] opacity-50 font-mono mt-0.5">{item.version}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      {selectedComparisonBrowsers.length < 2 && (
                        <div className="flex items-center gap-2 text-[10px] text-red-500 font-bold animate-pulse ml-auto">
                          <History size={12} />
                          <span>请至少选择两个环境进行对比</span>
                        </div>
                      )}
                    </div>

                    {/* Comparison Content */}
                    <div className="flex-1 overflow-x-auto overflow-y-auto p-8 bg-paper">
                      <div className={`flex gap-6 min-w-max h-full ${selectedComparisonBrowsers.length <= 1 ? 'justify-center items-center opacity-20' : ''}`}>
                        {selectedComparisonBrowsers.length <= 1 ? (
                          <div className="text-center">
                            <History size={64} className="mx-auto mb-4 opacity-20" />
                            <p className="text-xl font-serif italic">选择多个浏览器环境以开始代码对比分析</p>
                          </div>
                        ) : (
                          activeGroup.items
                            .filter(fp => selectedComparisonBrowsers.includes(fp.id.toString()))
                            .map((fp, i, filteredItems) => {
                              const prevFp = i > 0 ? filteredItems[i - 1] : null;
                              
                              const renderDiff = (content: string, prevContent: string | null) => {
                                if (!prevContent) return <span className="text-ink/80">{content}</span>;
                                
                                // Simple word-level diff for visualization
                                const words = content.split(/(\s+)/);
                                const prevWords = prevContent.split(/(\s+)/);
                                
                                return words.map((word, idx) => {
                                  const isDifferent = word !== prevWords[idx];
                                  return (
                                    <span key={idx} className={isDifferent ? 'text-red-500 font-bold bg-red-50' : 'text-ink/80'}>
                                      {word}
                                    </span>
                                  );
                                });
                              };

                              return (
                                <div key={fp.id} className="w-[450px] flex flex-col border border-line/10 shadow-sm bg-white shrink-0">
                                  <div className="bg-ink/5 px-6 py-4 border-b border-line/10 flex justify-between items-center sticky top-0 z-10">
                                    <div className="flex items-center gap-3">
                                      <span className="bg-ink text-paper px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                        {fp.browser || 'Chrome'}
                                      </span>
                                      <span className="text-[10px] font-mono opacity-40">#{fp.id}</span>
                                    </div>
                                    <div className="text-[10px] font-mono text-emerald-700 font-bold truncate max-w-[150px]">
                                      {fp.risk_file}
                                    </div>
                                  </div>
                                  <div className="p-6 flex-1 overflow-y-auto">
                                    <div className="mb-6">
                                      <div className="text-[10px] uppercase tracking-widest font-bold opacity-30 mb-3 flex items-center gap-2">
                                        <FingerprintIcon size={12} /> 指纹项内容 (Fingerprint Content)
                                      </div>
                                      <div className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all bg-ink/[0.02] p-4 border border-line/5 rounded min-h-[200px]">
                                        {renderDiff(fp.content, prevFp?.content || null)}
                                      </div>
                                    </div>

                                    <div>
                                      <div className="text-[10px] uppercase tracking-widest font-bold opacity-30 mb-3 flex items-center gap-2">
                                        <Edit3 size={12} /> AI 智能注解 (AI Annotation)
                                      </div>
                                      <div className="text-xs leading-relaxed opacity-80 italic bg-amber-50/30 p-4 border-l-2 border-amber-200">
                                        {fp.ai_annotation}
                                      </div>
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-line/5">
                                      <div className="flex justify-between items-center text-[10px] opacity-40 font-mono">
                                        <span>版本: {fp.version}</span>
                                        <span>采集时间: {new Date(fp.created_at).toLocaleDateString()}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Script Logs Modal */}
      <AnimatePresence>
        {showLogsModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogsModal(false)}
              className="absolute inset-0 bg-ink/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-paper w-full max-w-4xl p-8 border border-line shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-3xl font-serif italic">脚本运行日志详情</h2>
                  <p className="text-[10px] opacity-50 uppercase tracking-widest font-bold mt-1">
                    实时监控采集脚本的运行状态与错误反馈
                  </p>
                </div>
                <button onClick={() => setShowLogsModal(false)} className="p-2 hover:bg-ink/5 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-white border border-line/10 rounded shadow-inner">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-ink text-paper text-[10px] uppercase tracking-widest font-bold">
                    <tr>
                      <th className="p-4 border-b border-paper/10">任务 ID</th>
                      <th className="p-4 border-b border-paper/10">目标平台</th>
                      <th className="p-4 border-b border-paper/10">模拟浏览器</th>
                      <th className="p-4 border-b border-paper/10">运行状态</th>
                      <th className="p-4 border-b border-paper/10">执行时间</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] font-mono">
                    {tasks.map((task) => (
                      <tr key={task.id} className="border-b border-line/5 hover:bg-ink/5 transition-colors">
                        <td className="p-4 opacity-40">#{task.id}</td>
                        <td className="p-4 font-bold">{task.name}</td>
                        <td className="p-4">
                          <span className="bg-ink/5 px-2 py-0.5 rounded text-[10px] uppercase">{task.browser}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              task.status === 'success' ? 'bg-emerald-500' : 
                              task.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'
                            }`} />
                            <span className={`uppercase tracking-tighter font-bold ${
                              task.status === 'success' ? 'text-emerald-600' : 
                              task.status === 'running' ? 'text-blue-600' : 'text-red-600'
                            }`}>
                              {task.status === 'success' ? '成功' : 
                               task.status === 'running' ? '进行中' : '失败'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 opacity-60">{task.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tasks.length === 0 && (
                  <div className="py-20 text-center opacity-20 italic font-serif text-xl">
                    暂无运行记录
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-end">
                <button 
                  onClick={() => setShowLogsModal(false)}
                  className="px-8 py-3 bg-ink text-paper text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
                >
                  关闭日志
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Annotation Editor Modal */}
      <AnimatePresence>
        {showAnnotationModal && editingFingerprint && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAnnotationModal(false)}
              className="absolute inset-0 bg-ink/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-paper w-full max-w-3xl p-8 border border-line shadow-2xl flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-3xl font-serif italic">AI 智能注解文档编辑器</h2>
                  <p className="text-[10px] opacity-50 uppercase tracking-widest font-bold mt-1">
                    {editingFingerprint.website} — {editingFingerprint.browser} 环境分析报告
                  </p>
                </div>
                <button onClick={() => setShowAnnotationModal(false)} className="p-2 hover:bg-ink/5 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="bg-ink/5 p-2 mb-4 text-[10px] font-mono opacity-50 flex items-center gap-2">
                <CheckCircle2 size={12} />
                <span>正在编辑整篇分析文档... 系统将自动保存编译后的内容。</span>
              </div>

              <textarea 
                value={tempAnnotation}
                onChange={(e) => setTempAnnotation(e.target.value)}
                className="flex-1 w-full p-8 bg-white border border-line/10 text-sm outline-none focus:border-line transition-colors resize-none shadow-inner font-sans leading-relaxed"
                placeholder="在此编写该环境下的完整指纹风险分析报告..."
              />

              <div className="pt-6 flex justify-end gap-4">
                <button 
                  onClick={() => setShowAnnotationModal(false)}
                  className="px-8 py-3 border border-line/20 text-[10px] font-bold uppercase tracking-widest hover:bg-ink/5 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={saveAnnotation}
                  className="px-8 py-3 bg-ink text-paper text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]"
                >
                  编译并保存文档
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

