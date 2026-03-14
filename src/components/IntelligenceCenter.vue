<script setup lang="ts">
import { 
  RefreshCw, 
  Calendar, 
  Cpu, 
  History, 
  Fingerprint as FingerprintIcon, 
  CheckCircle2, 
  Loader2, 
  Monitor,
  ShieldCheck,
  Layout
} from 'lucide-vue-next';

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

const props = defineProps<{
  fingerprints: Fingerprint[];
  groupedFingerprints: Record<string, { website: string, url: string, logic: string, items: Fingerprint[] }>;
  loading: boolean;
  page: number;
  totalItems: number;
  totalPages: number;
  platformCount: number;
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'open-crawl'): void;
  (e: 'open-logs'): void;
  (e: 'open-comparison', group: any): void;
  (e: 'open-detection', fp: Fingerprint): void;
  (e: 'update:page', value: number): void;
}>();
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
          @click="emit('refresh')"
          class="p-3 border border-line/20 hover:bg-ink hover:text-paper transition-all"
        >
          <RefreshCw :size="18" :class="{ 'animate-spin': loading }" />
        </button>
        <button 
          @click="emit('open-crawl')"
          class="flex items-center gap-2 px-6 py-3 bg-ink text-paper rounded-none hover:opacity-90 transition-opacity shadow-[4px_4px_0px_0px_rgba(20,20,20,0.2)]"
        >
          <Calendar :size="18" />
          <span class="text-sm font-bold tracking-wider">定时跑脚本</span>
        </button>
        <button 
          @click="emit('open-logs')"
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
        { label: '覆盖平台', value: platformCount, icon: Cpu },
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
              <button @click="emit('open-comparison', group)" class="text-[10px] uppercase tracking-widest font-bold opacity-40 hover:opacity-100 flex items-center gap-1 transition-all">
                <Monitor :size="12" /> 采集环境对比
              </button>
              <button @click="emit('open-detection', group.items[0])" class="text-[10px] uppercase tracking-widest font-bold opacity-40 hover:opacity-100 flex items-center gap-1 transition-all">
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
            @click="emit('update:page', Math.max(1, page - 1))"
            :disabled="page === 1"
            class="px-4 py-2 border border-line/10 text-[10px] font-bold uppercase tracking-widest hover:bg-ink hover:text-paper disabled:opacity-20 transition-all"
          >
            上一页
          </button>
          <button 
            @click="emit('update:page', Math.min(totalPages, page + 1))"
            :disabled="page === totalPages"
            class="px-4 py-2 border border-line/10 text-[10px] font-bold uppercase tracking-widest hover:bg-ink hover:text-paper disabled:opacity-20 transition-all"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
