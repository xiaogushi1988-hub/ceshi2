<script setup lang="ts">
import { ref } from 'vue';
import { Plus, CheckCircle2, Loader2 } from 'lucide-vue-next';

const props = defineProps<{
  show: boolean;
  crawling: boolean;
  availablePlatforms: { name: string; url: string }[];
  availableBrowsers: { name: string; config: string }[];
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'crawl', data: { platforms: string[]; browsers: string[] }): void;
  (e: 'add-platform', platform: { name: string; url: string }): void;
  (e: 'add-browser', browser: { name: string; config: string }): void;
}>();

const selectedPlatforms = ref<string[]>([]);
const selectedBrowsers = ref<string[]>(['Chrome']);

const showAddPlatform = ref(false);
const newPlatformName = ref('');
const newPlatformUrl = ref('');

const showAddBrowser = ref(false);
const newBrowserName = ref('');
const newBrowserConfig = ref('');

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
  if (selectedPlatforms.value.length === props.availablePlatforms.length) {
    selectedPlatforms.value = [];
  } else {
    selectedPlatforms.value = props.availablePlatforms.map(p => p.name);
  }
};

const handleAddPlatform = () => {
  if (!newPlatformName.value || !newPlatformUrl.value) return;
  emit('add-platform', { name: newPlatformName.value, url: newPlatformUrl.value });
  newPlatformName.value = '';
  newPlatformUrl.value = '';
  showAddPlatform.value = false;
};

const handleAddBrowser = () => {
  if (!newBrowserName.value || !newBrowserConfig.value) return;
  emit('add-browser', { name: newBrowserName.value, config: newBrowserConfig.value });
  newBrowserName.value = '';
  newBrowserConfig.value = '';
  showAddBrowser.value = false;
};

const handleCrawl = () => {
  emit('crawl', { platforms: selectedPlatforms.value, browsers: selectedBrowsers.value });
};
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div @click="emit('update:show', false)" class="absolute inset-0 bg-ink/40 backdrop-blur-sm"></div>
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
            <button @click="handleAddPlatform" class="w-full py-2 bg-ink text-paper text-[10px] font-bold uppercase tracking-widest">确认添加</button>
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
            <button @click="handleAddBrowser" class="w-full py-2 bg-ink text-paper text-[10px] font-bold uppercase tracking-widest">确认添加</button>
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
</template>
