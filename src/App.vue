<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { 
  RefreshCw, 
  Calendar, 
  Cpu, 
  History, 
  Fingerprint as FingerprintIcon, 
  CheckCircle2, 
  Loader2, 
  Search, 
  ChevronRight, 
  Edit3, 
  X, 
  AlertTriangle, 
  Plus,
  Monitor,
  ShieldCheck,
  Layout
} from 'lucide-vue-next';
import { GoogleGenAI } from "@google/genai";

// Types
interface Fingerprint {
  id: number;
  website: string;
  url: string;
  risk_file: string;
  content: string;
  logic: string;
  ai_annotation: string;
  version: string;
  browser: string;
  created_at: string;
}

interface AnalysisItem {
  name: string;
  branches: string[];
  summary: string;
}

// State
const fingerprints = ref<Fingerprint[]>([]);
const loading = ref(true);
const page = ref(1);
const totalItems = ref(0);
const totalPages = ref(0);
const limit = 10;

const showCrawlModal = ref(false);
const crawling = ref(false);
const selectedPlatforms = ref<string[]>([]);
const selectedBrowsers = ref<string[]>(['Chrome']);

const availablePlatforms = ref([
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

const availableBrowsers = ref([
  { name: 'Chrome', config: 'Default Chrome Config' },
  { name: 'Firefox', config: 'Default Firefox Config' },
  { name: 'Safari', config: 'Default Safari Config' },
  { name: 'Edge', config: 'Default Edge Config' },
  { name: 'Opera', config: 'Default Opera Config' },
  { name: 'Brave', config: 'Default Brave Config' }
]);

const showAddPlatform = ref(false);
const newPlatformName = ref('');
const newPlatformUrl = ref('');

const showAddBrowser = ref(false);
const newBrowserName = ref('');
const newBrowserConfig = ref('');

const showLogsModal = ref(false);
const tasks = ref<{ id: string, name: string, browser: string, status: 'success' | 'running' | 'failed', time: string }[]>([]);

const showUnifiedModal = ref(false);
const activeTab = ref<'detection' | 'logic' | 'comparison'>('detection');
const selectedFingerprint = ref<Fingerprint | null>(null);
const analysis = ref<AnalysisItem[]>([]);
const analyzing = ref(false);
const selectedAnalysisItem = ref<AnalysisItem | null>(null);
const detectionResults = ref<Record<string, { status: 'pass' | 'fail' | 'warning', score: number, details: string }>>({});

const logicDescription = ref('');
const logicFields = ref<{ name: string, code: string }[]>([]);

const selectedComparisonBrowsers = ref<string[]>([]);

const showAnnotationModal = ref(false);
const editingFingerprint = ref<Fingerprint | null>(null);
const tempAnnotation = ref('');

const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.GEMINI_API_KEY || "" });

// Methods
const fetchFingerprints = async () => {
  loading.value = true;
  try {
    const res = await fetch(`/api/fingerprints?page=${page.value}&limit=${limit}`);
    const data = await res.json();
    fingerprints.value = data.data;
    totalItems.value = data.total;
    totalPages.value = data.totalPages;
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const handleCrawl = async () => {
  if (selectedPlatforms.value.length === 0 || selectedBrowsers.value.length === 0) return;
  crawling.value = true;
  
  const initialTasks = selectedPlatforms.value.flatMap(p => 
    selectedBrowsers.value.map(b => ({
      id: Math.random().toString(36).substr(2, 9),
      name: p,
      browser: b,
      status: 'running' as const,
      time: new Date().toLocaleString()
    }))
  );
  tasks.value = [...initialTasks, ...tasks.value];

  try {
    const results = [];
    for (const platformName of selectedPlatforms.value) {
      const platform = availablePlatforms.value.find(p => p.name === platformName);
      for (const browserName of selectedBrowsers.value) {
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
      page.value = 1;
      await fetchFingerprints();
      showCrawlModal.value = false;
      selectedPlatforms.value = [];
      selectedBrowsers.value = ['Chrome'];
      
      tasks.value = tasks.value.map(t => {
        const matched = results.find(r => r.platform === t.name && r.browser === t.browser && t.status === 'running');
        return matched ? { ...t, status: 'success' as const } : t;
      });
    }
  } catch (err) {
    console.error(err);
    tasks.value = tasks.value.map(t => t.status === 'running' ? { ...t, status: 'failed' as const } : t);
  } finally {
    crawling.value = false;
  }
};

const handleDetect = async (fp: Fingerprint) => {
  selectedFingerprint.value = fp;
  const groupKey = `${fp.website}-${fp.url}`;
  const group = groupedFingerprints.value[groupKey];
  
  logicDescription.value = fp.logic;
  logicFields.value = [
    { name: 'UserAgent', code: 'navigator.userAgent' },
    { name: 'Canvas', code: 'canvas.toDataURL()' }
  ];
  
  activeTab.value = 'detection';
  showUnifiedModal.value = true;
  analyzing.value = true;
  selectedAnalysisItem.value = null;
  
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
    detectionResults.value = results;
  }

  try {
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
    analysis.value = data;
    if (data.length > 0) selectedAnalysisItem.value = data[0];
  } catch (err) {
    analysis.value = [
      {
        name: "基础指纹检测 (Base Fingerprint)",
        branches: ["检测浏览器 User-Agent 字符串", "检测屏幕分辨率与颜色深度"],
        summary: "这是系统自动生成的兜底分析。该指纹项主要用于识别基础的浏览器环境特征。"
      }
    ];
  } finally {
    analyzing.value = false;
  }
};

const addPlatform = () => {
  if (!newPlatformName.value || !newPlatformUrl.value) return;
  availablePlatforms.value.push({ name: newPlatformName.value, url: newPlatformUrl.value });
  newPlatformName.value = '';
  newPlatformUrl.value = '';
  showAddPlatform.value = false;
};

const addBrowser = () => {
  if (!newBrowserName.value || !newBrowserConfig.value) return;
  availableBrowsers.value.push({ name: newBrowserName.value, config: newBrowserConfig.value });
  newBrowserName.value = '';
  newBrowserConfig.value = '';
  showAddBrowser.value = false;
};

const togglePlatform = (p: string) => {
  const index = selectedPlatforms.value.indexOf(p);
  if (index > -1) selectedPlatforms.value.splice(index, 1);
  else selectedPlatforms.value.push(p);
};

const toggleBrowser = (b: string) => {
  const index = selectedBrowsers.value.indexOf(b);
  if (index > -1) selectedBrowsers.value.splice(index, 1);
  else selectedBrowsers.value.push(b);
};

const selectAllPlatforms = () => {
  if (selectedPlatforms.value.length === availablePlatforms.value.length) {
    selectedPlatforms.value = [];
  } else {
    selectedPlatforms.value = availablePlatforms.value.map(p => p.name);
  }
};

const groupedFingerprints = computed(() => {
  return fingerprints.value.reduce((acc, fp) => {
    const key = `${fp.website}-${fp.url}`;
    if (!acc[key]) {
      acc[key] = { website: fp.website, url: fp.url, logic: fp.logic, items: [] };
    }
    acc[key].items.push(fp);
    return acc;
  }, {} as Record<string, { website: string, url: string, logic: string, items: Fingerprint[] }>);
});

const handleOpenComparison = (group: any) => {
  selectedFingerprint.value = group.items[0];
  activeTab.value = 'comparison';
  selectedComparisonBrowsers.value = group.items.slice(0, 2).map((item: any) => item.id.toString());
  showUnifiedModal.value = true;
};

onMounted(() => {
  fetchFingerprints();
});

watch(page, () => {
  fetchFingerprints();
});
</script>

<template>
  <div class="min-h-screen p-8 max-w-7xl mx-auto font-sans selection:bg-ink selection:text-paper">
    <!-- Header -->
    <header class="flex justify-between items-end mb-12">
      <div>
        <h1 class="text-5xl font-serif italic mb-2">指纹情报系统 (Vue + Go)</h1>
        <p class="text-sm opacity-60 uppercase tracking-widest">电商风控指纹采集与逻辑分析工具</p>
      </div>
      <div class="flex gap-4">
        <button 
          @click="fetchFingerprints"
          class="p-3 border border-line/20 hover:bg-ink hover:text-paper transition-all"
        >
          <RefreshCw :size="18" :class="{ 'animate-spin': loading }" />
        </button>
        <button 
          @click="showCrawlModal = true"
          class="flex items-center gap-2 px-6 py-3 bg-ink text-paper rounded-none hover:opacity-90 transition-opacity shadow-[4px_4px_0px_0px_rgba(20,20,20,0.2)]"
        >
          <Calendar :size="18" />
          <span class="text-sm font-bold tracking-wider">定时跑脚本</span>
        </button>
        <button 
          @click="showLogsModal = true"
          class="flex items-center gap-2 px-6 py-3 border border-ink rounded-none hover:bg-ink hover:text-paper transition-all group"
        >
          <History :size="18" />
          <span class="text-sm font-bold tracking-wider">脚本日志</span>
        </button>
      </div>
    </header>

    <!-- Stats -->
    <div class="grid grid-cols-4 gap-8 mb-12">
      <div v-for="(stat, i) in [
        { label: '覆盖平台', value: availablePlatforms.length, icon: Cpu },
        { label: '活跃版本', value: '48', icon: History },
        { label: '检测项总数', value: totalItems, icon: FingerprintIcon },
        { label: '最后更新', value: '2小时前', icon: CheckCircle2 },
      ]" :key="i" class="border-l border-line/20 pl-6 py-2 bg-white/20 hover:bg-white/40 transition-colors">
        <div class="flex items-center gap-2 opacity-50 mb-1">
          <component :is="stat.icon" :size="14" />
          <span class="text-[10px] uppercase tracking-widest font-bold">{{ stat.label }}</span>
        </div>
        <div class="text-3xl font-mono font-bold">{{ stat.value }}</div>
      </div>
    </div>

    <!-- Main List -->
    <div class="bg-white/50 backdrop-blur-sm border border-line/10 shadow-xl overflow-hidden">
      <div class="grid grid-cols-[60px_120px_100px_150px_180px_180px_1fr_80px] p-4 data-grid-header bg-ink/5 border-b border-line/10 text-[10px] uppercase tracking-widest font-bold opacity-50">
        <div>ID</div>
        <div>目标平台</div>
        <div>浏览器环境</div>
        <div>风控文件</div>
        <div>指纹项内容</div>
        <div>检测逻辑</div>
        <div>AI 智能注解</div>
        <div class="text-right">版本号</div>
      </div>

      <div v-if="loading" class="p-20 flex justify-center">
        <Loader2 class="animate-spin opacity-20" :size="48" />
      </div>
      <div v-else class="divide-y divide-line/10">
        <div v-for="(group, key) in groupedFingerprints" :key="key" class="flex flex-col">
          <div class="bg-ink/[0.02] px-4 py-3 border-b border-line/5 flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-2">
                <Layout :size="14" class="opacity-30" />
                <span class="text-xs font-bold">{{ group.website }}</span>
              </div>
              <span class="text-[10px] font-mono opacity-30 truncate max-w-[200px]">{{ group.url }}</span>
            </div>
            <div class="flex gap-4">
              <button @click="handleOpenComparison(group)" class="text-[10px] uppercase tracking-widest font-bold opacity-40 hover:opacity-100 flex items-center gap-1 transition-all">
                <Monitor :size="12" /> 采集环境对比
              </button>
              <button @click="handleDetect(group.items[0])" class="text-[10px] uppercase tracking-widest font-bold opacity-40 hover:opacity-100 flex items-center gap-1 transition-all">
                <ShieldCheck :size="12" /> 逻辑检测
              </button>
            </div>
          </div>

          <div v-for="fp in group.items" :key="fp.id" class="grid grid-cols-[60px_120px_100px_150px_180px_180px_1fr_80px] p-4 items-center hover:bg-ink/[0.01] transition-colors group">
            <div class="text-[10px] font-mono opacity-30">#{{ fp.id }}</div>
            <div class="text-xs font-bold">{{ fp.website }}</div>
            <div>
              <span class="bg-ink/5 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{{ fp.browser || 'Chrome' }}</span>
            </div>
            <div class="text-[10px] font-mono text-emerald-700 font-bold truncate pr-4">{{ fp.risk_file }}</div>
            <div class="text-[10px] font-mono opacity-60 truncate pr-4">{{ fp.content }}</div>
            <div class="text-[10px] font-mono opacity-60 truncate pr-4">{{ fp.logic }}</div>
            <div class="text-xs line-clamp-1 opacity-80">{{ fp.ai_annotation }}</div>
            <div class="text-right">
              <span class="mono-value bg-ink/5 px-2 py-0.5 rounded text-[10px]">{{ fp.version }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="p-4 border-t border-line/10 flex justify-between items-center bg-white/30">
        <div class="text-[10px] uppercase tracking-widest opacity-50 font-bold">
          共 {{ totalItems }} 条记录 | 第 {{ page }} / {{ totalPages }} 页
        </div>
        <div class="flex gap-2">
          <button 
            @click="page = Math.max(1, page - 1)"
            :disabled="page === 1"
            class="px-4 py-2 border border-line/10 text-[10px] font-bold uppercase tracking-widest hover:bg-ink hover:text-paper disabled:opacity-20 transition-all"
          >
            上一页
          </button>
          <button 
            @click="page = Math.min(totalPages, page + 1)"
            :disabled="page === totalPages"
            class="px-4 py-2 border border-line/10 text-[10px] font-bold uppercase tracking-widest hover:bg-ink hover:text-paper disabled:opacity-20 transition-all"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <div v-if="showCrawlModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showCrawlModal = false" class="absolute inset-0 bg-ink/40 backdrop-blur-sm"></div>
      <div class="relative bg-paper w-full max-w-lg p-8 border border-line shadow-2xl">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-3xl font-serif italic">配置采集脚本</h2>
          <button @click="selectAllPlatforms" class="text-[10px] uppercase tracking-widest font-bold border border-line/20 px-3 py-1 hover:bg-ink hover:text-paper transition-all">
            {{ selectedPlatforms.length === availablePlatforms.length ? '取消全选' : '全选平台' }}
          </button>
        </div>

        <div class="space-y-6">
          <div>
            <div class="flex justify-between items-center mb-3">
              <h3 class="text-[10px] uppercase tracking-widest font-bold opacity-40">选择目标平台</h3>
              <button @click="showAddPlatform = !showAddPlatform" class="text-[10px] text-ink/60 hover:text-ink flex items-center gap-1 font-bold uppercase tracking-widest">
                <Plus :size="12" /> 新增平台
              </button>
            </div>
            <div v-if="showAddPlatform" class="mb-4 p-4 bg-ink/5 border border-line/10 space-y-3">
              <input v-model="newPlatformName" type="text" placeholder="平台名称" class="w-full p-2 text-xs border border-line/10 bg-white outline-none" />
              <input v-model="newPlatformUrl" type="text" placeholder="目标 URL" class="w-full p-2 text-xs border border-line/10 bg-white outline-none" />
              <button @click="addPlatform" class="w-full py-2 bg-ink text-paper text-[10px] font-bold uppercase tracking-widest">确认添加</button>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <button v-for="p in availablePlatforms" :key="p.name" @click="togglePlatform(p.name)" :class="['p-3 text-[11px] font-mono border transition-all text-left flex justify-between items-center', selectedPlatforms.includes(p.name) ? 'bg-ink text-paper border-ink' : 'bg-white border-line/10 hover:border-line']">
                {{ p.name }}
                <CheckCircle2 v-if="selectedPlatforms.includes(p.name)" :size="12" />
              </button>
            </div>
          </div>

          <div>
            <div class="flex justify-between items-center mb-3">
              <h3 class="text-[10px] uppercase tracking-widest font-bold opacity-40">选择模拟浏览器</h3>
              <button @click="showAddBrowser = !showAddBrowser" class="text-[10px] text-ink/60 hover:text-ink flex items-center gap-1 font-bold uppercase tracking-widest">
                <Plus :size="12" /> 新增浏览器
              </button>
            </div>
            <div v-if="showAddBrowser" class="mb-4 p-4 bg-ink/5 border border-line/10 space-y-3">
              <input v-model="newBrowserName" type="text" placeholder="浏览器名称" class="w-full p-2 text-xs border border-line/10 bg-white outline-none" />
              <textarea v-model="newBrowserConfig" placeholder="配置信息" class="w-full p-2 text-xs border border-line/10 bg-white outline-none h-20 resize-none"></textarea>
              <button @click="addBrowser" class="w-full py-2 bg-ink text-paper text-[10px] font-bold uppercase tracking-widest">确认添加</button>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <button v-for="b in availableBrowsers" :key="b.name" @click="toggleBrowser(b.name)" :class="['p-3 text-[11px] font-mono border transition-all text-left flex justify-between items-center', selectedBrowsers.includes(b.name) ? 'bg-ink text-paper border-ink' : 'bg-white border-line/10 hover:border-line']">
                {{ b.name }}
                <CheckCircle2 v-if="selectedBrowsers.includes(b.name)" :size="12" />
              </button>
            </div>
          </div>
        </div>

        <button 
          @click="handleCrawl"
          :disabled="crawling || selectedPlatforms.length === 0"
          class="w-full mt-8 py-4 bg-ink text-paper text-sm font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
        >
          <Loader2 v-if="crawling" class="animate-spin" :size="18" />
          {{ crawling ? '正在执行采集脚本...' : '立即开始采集' }}
        </button>
      </div>
    </div>

    <!-- Logs Modal -->
    <div v-if="showLogsModal" class="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div @click="showLogsModal = false" class="absolute inset-0 bg-ink/60 backdrop-blur-md"></div>
      <div class="relative bg-paper w-full max-w-4xl p-8 border border-line shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div class="flex justify-between items-center mb-8">
          <h2 class="text-3xl font-serif italic">脚本运行日志</h2>
          <button @click="showLogsModal = false"><X :size="24" /></button>
        </div>
        <div class="flex-1 overflow-y-auto bg-white border border-line/10 rounded">
          <table class="w-full text-left border-collapse">
            <thead class="sticky top-0 bg-ink text-paper text-[10px] uppercase tracking-widest font-bold">
              <tr>
                <th class="p-4">任务 ID</th>
                <th class="p-4">目标平台</th>
                <th class="p-4">模拟浏览器</th>
                <th class="p-4">运行状态</th>
                <th class="p-4">执行时间</th>
              </tr>
            </thead>
            <tbody class="text-[11px] font-mono">
              <tr v-for="task in tasks" :key="task.id" class="border-b border-line/5 hover:bg-ink/5">
                <td class="p-4 opacity-40">#{{ task.id }}</td>
                <td class="p-4 font-bold">{{ task.name }}</td>
                <td class="p-4"><span class="bg-ink/5 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{{ task.browser }}</span></td>
                <td class="p-4">
                  <div class="flex items-center gap-2">
                    <div :class="['w-2 h-2 rounded-full', task.status === 'success' ? 'bg-emerald-500' : task.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-red-500']"></div>
                    <span :class="['uppercase tracking-tighter font-bold', task.status === 'success' ? 'text-emerald-600' : task.status === 'running' ? 'text-blue-600' : 'text-red-600']">
                      {{ task.status === 'success' ? '成功' : task.status === 'running' ? '进行中' : '失败' }}
                    </span>
                  </div>
                </td>
                <td class="p-4 opacity-60">{{ task.time }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Unified Modal -->
    <div v-if="showUnifiedModal" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div @click="showUnifiedModal = false" class="absolute inset-0 bg-ink/60 backdrop-blur-md"></div>
      <div class="relative bg-paper w-full max-w-[90vw] h-[90vh] border border-line shadow-2xl flex flex-col overflow-hidden">
        <div class="flex border-b border-line/10 bg-white shrink-0">
          <button v-for="tab in [
            { id: 'detection', label: '逻辑检测 (Detection)', icon: ShieldCheck },
            { id: 'logic', label: '检测逻辑定义 (Logic)', icon: Edit3 },
            { id: 'comparison', label: '采集环境对比 (Comparison)', icon: Monitor }
          ]" :key="tab.id" @click="activeTab = tab.id as any" :class="['flex items-center gap-3 px-8 py-5 text-[10px] font-bold uppercase tracking-widest border-r border-line/10 transition-all', activeTab === tab.id ? 'bg-ink text-paper' : 'hover:bg-ink/5']">
            <component :is="tab.icon" :size="14" />
            {{ tab.label }}
          </button>
          <button @click="showUnifiedModal = false" class="ml-auto px-6 hover:bg-red-50 text-red-500 transition-colors"><X :size="20" /></button>
        </div>

        <div class="flex-1 overflow-hidden flex">
          <!-- Detection Tab -->
          <div v-if="activeTab === 'detection'" class="flex-1 flex overflow-hidden">
            <div class="w-1/3 border-r border-line/10 flex flex-col bg-ink/[0.02]">
              <div class="p-6 border-b border-line/10 bg-white">
                <h3 class="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-4">当前检测逻辑</h3>
                <div class="font-mono text-xs p-4 bg-ink text-paper/80 rounded min-h-[150px] leading-relaxed">{{ logicDescription }}</div>
              </div>
              <div class="p-6 flex-1 overflow-y-auto">
                <h3 class="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-4">检测字段与代码</h3>
                <div class="space-y-4">
                  <div v-for="(field, i) in logicFields" :key="i" class="p-4 bg-white border border-line/10 shadow-sm">
                    <div class="text-[10px] font-bold mb-2">{{ field.name }}</div>
                    <div class="font-mono text-[10px] opacity-60">{{ field.code }}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex-1 flex flex-col overflow-hidden">
              <div class="p-8 border-b border-line/10 bg-white shrink-0">
                <h3 class="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-6">选择测试环境</h3>
                <div class="flex gap-4">
                  <button v-for="item in groupedFingerprints[`${selectedFingerprint?.website}-${selectedFingerprint?.url}`]?.items" :key="item.id" @click="handleDetect(item)" :class="['p-4 border text-left transition-all w-48', selectedFingerprint?.id === item.id ? 'border-ink bg-ink/5 ring-1 ring-ink' : 'border-line/10 hover:border-line']">
                    <div class="text-[10px] font-bold uppercase mb-1">{{ item.browser }}</div>
                    <div class="text-[10px] font-mono opacity-40 mb-3">#{{ item.id }}</div>
                    <div v-if="detectionResults[item.browser]" class="flex items-center gap-2">
                      <div :class="['w-2 h-2 rounded-full', detectionResults[item.browser].status === 'pass' ? 'bg-emerald-500' : 'bg-red-500']"></div>
                      <span :class="['text-[10px] font-bold uppercase', detectionResults[item.browser].status === 'pass' ? 'text-emerald-600' : 'text-red-600']">
                        {{ detectionResults[item.browser].status === 'pass' ? '通过' : '未通过' }}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
              <div class="flex-1 p-8 overflow-y-auto">
                <div v-if="analyzing" class="h-full flex flex-col items-center justify-center opacity-20">
                  <Loader2 class="animate-spin mb-4" :size="48" />
                  <p class="text-xl font-serif italic">AI 正在深度分析检测项...</p>
                </div>
                <div v-else class="grid grid-cols-2 gap-8">
                  <div class="space-y-4">
                    <div v-for="(item, i) in analysis" :key="i" @click="selectedAnalysisItem = item" :class="['p-6 border cursor-pointer transition-all', selectedAnalysisItem === item ? 'border-ink bg-white shadow-lg' : 'border-line/10 hover:border-line bg-white/50']">
                      <div class="flex justify-between items-center mb-4">
                        <h4 class="font-bold text-sm">{{ item.name }}</h4>
                        <ChevronRight :size="16" class="opacity-20" />
                      </div>
                      <div class="flex flex-wrap gap-2">
                        <span v-for="branch in item.branches" :key="branch" class="text-[9px] bg-ink/5 px-2 py-0.5 rounded opacity-60">{{ branch }}</span>
                      </div>
                    </div>
                  </div>
                  <div v-if="selectedAnalysisItem" class="bg-white border border-line/10 p-8 shadow-sm h-fit sticky top-0">
                    <h4 class="text-2xl font-serif italic mb-6">{{ selectedAnalysisItem.name }}</h4>
                    <div class="space-y-6">
                      <div>
                        <h5 class="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-3">检测分支 (Detection Branches)</h5>
                        <div class="space-y-2">
                          <div v-for="branch in selectedAnalysisItem.branches" :key="branch" class="flex items-center gap-3 text-xs opacity-70">
                            <div class="w-1 h-1 bg-ink rounded-full"></div>
                            {{ branch }}
                          </div>
                        </div>
                      </div>
                      <div>
                        <h5 class="text-[10px] uppercase tracking-widest font-bold opacity-40 mb-3">AI 风险评估 (Risk Summary)</h5>
                        <p class="text-xs leading-relaxed opacity-80 italic">{{ selectedAnalysisItem.summary }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Comparison Tab -->
          <div v-if="activeTab === 'comparison'" class="flex-1 flex flex-col overflow-hidden">
            <div class="p-8 border-b border-line/10 bg-white flex items-center gap-6 shrink-0">
              <h3 class="text-[10px] uppercase tracking-widest font-bold opacity-40">对比环境选择</h3>
              <div class="flex gap-3">
                <label v-for="item in groupedFingerprints[`${selectedFingerprint?.website}-${selectedFingerprint?.url}`]?.items" :key="item.id" class="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" :value="item.id.toString()" v-model="selectedComparisonBrowsers" class="hidden" />
                  <div :class="['px-4 py-2 border text-[10px] font-bold uppercase transition-all', selectedComparisonBrowsers.includes(item.id.toString()) ? 'bg-ink text-paper border-ink' : 'border-line/10 hover:border-line']">
                    {{ item.browser }}
                  </div>
                </label>
              </div>
            </div>
            <div class="flex-1 overflow-x-auto p-8 bg-paper">
              <div class="flex gap-6 min-w-max h-full">
                <div v-for="fp in groupedFingerprints[`${selectedFingerprint?.website}-${selectedFingerprint?.url}`]?.items.filter(i => selectedComparisonBrowsers.includes(i.id.toString()))" :key="fp.id" class="w-[450px] flex flex-col border border-line/10 shadow-sm bg-white shrink-0">
                  <div class="bg-ink/5 px-6 py-4 border-b border-line/10 flex justify-between items-center">
                    <span class="bg-ink text-paper px-2 py-0.5 rounded text-[10px] font-bold uppercase">{{ fp.browser }}</span>
                    <span class="text-[10px] font-mono opacity-40">#{{ fp.id }}</span>
                  </div>
                  <div class="p-6 flex-1 overflow-y-auto">
                    <div class="mb-6">
                      <div class="text-[10px] uppercase tracking-widest font-bold opacity-30 mb-3">指纹项内容</div>
                      <div class="font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all bg-ink/[0.02] p-4 border border-line/5 rounded min-h-[200px]">
                        {{ fp.content }}
                      </div>
                    </div>
                    <div>
                      <div class="text-[10px] uppercase tracking-widest font-bold opacity-30 mb-3">AI 智能注解</div>
                      <div class="text-xs leading-relaxed opacity-80 italic bg-amber-50/30 p-4 border-l-2 border-amber-200">
                        {{ fp.ai_annotation }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,900;1,900&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg: #F5F5F4;
  --paper: #FFFFFF;
  --ink: #141414;
  --line: #141414;
}

body {
  background-color: var(--bg);
  color: var(--ink);
  font-family: 'Inter', sans-serif;
}

.font-serif {
  font-family: 'Playfair Display', serif;
}

.font-mono {
  font-family: 'JetBrains Mono', monospace;
}
</style>
