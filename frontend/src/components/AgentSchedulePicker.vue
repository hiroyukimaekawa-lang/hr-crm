<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-vue-next';

const props = defineProps<{
  modelValue: string; // ISO datetime string: "YYYY-MM-DDTHH:00"
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

// ─── State ───

const today = new Date();
const todayStr = today.toISOString().slice(0, 10);

/** Calendar navigation month (displayed) */
const viewYear  = ref(today.getFullYear());
const viewMonth = ref(today.getMonth()); // 0-indexed

/** Selected date part */
const selectedDate = ref<string>(''); // "YYYY-MM-DD"

/** Selected hour (0–23) */
const selectedHour = ref<number>(10);

// Hour options: 08:00 – 21:00 (common business hours)
const hourOptions = Array.from({ length: 14 }, (_, i) => i + 8); // 8–21

// ─── Calendar computation ───

const calendarTitle = computed(() => {
  const d = new Date(viewYear.value, viewMonth.value, 1);
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
});

/** Days to render in the 7-column calendar grid (includes padding nulls) */
const calendarDays = computed(() => {
  const firstDay = new Date(viewYear.value, viewMonth.value, 1).getDay(); // 0=Sun
  const dayShift = firstDay === 0 ? 6 : firstDay - 1; // Mon-start: Mon=0
  const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate();
  const cells: (number | null)[] = Array(dayShift).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
});

const prevMonth = () => {
  if (viewMonth.value === 0) { viewYear.value--; viewMonth.value = 11; }
  else viewMonth.value--;
};

const nextMonth = () => {
  if (viewMonth.value === 11) { viewYear.value++; viewMonth.value = 0; }
  else viewMonth.value++;
};

const pad = (n: number) => String(n).padStart(2, '0');

const dayStr = (day: number) =>
  `${viewYear.value}-${pad(viewMonth.value + 1)}-${pad(day)}`;

const isToday = (day: number) => dayStr(day) === todayStr;
const isSelected = (day: number) => dayStr(day) === selectedDate.value;
const isPast = (day: number) => dayStr(day) < todayStr;

const selectDay = (day: number | null) => {
  if (!day || isPast(day)) return;
  selectedDate.value = dayStr(day);
  emitValue();
};

const emitValue = () => {
  if (!selectedDate.value) return;
  emit('update:modelValue', `${selectedDate.value}T${pad(selectedHour.value)}:00`);
};

watch(selectedHour, emitValue);

// ─── Sync from external modelValue ───

const syncFromProp = (val: string) => {
  if (!val) return;
  const m = val.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}))?/);
  if (!m || !m[1]) return;
  selectedDate.value = m[1];
  if (m[2]) selectedHour.value = Number(m[2]);
  // Sync calendar view to selected date
  const parts = m[1].split('-');
  viewYear.value  = Number(parts[0] ?? viewYear.value);
  viewMonth.value = Number(parts[1] ?? (viewMonth.value + 1)) - 1;
};

watch(() => props.modelValue, syncFromProp, { immediate: true });

// Display helper
const dayOfWeekLabels = ['月', '火', '水', '木', '金', '土', '日'];

const dayTextColor = (colIndex: number, day: number | null, isSelected: boolean) => {
  if (isSelected) return 'text-white';
  if (colIndex === 5) return 'text-blue-500'; // 土
  if (colIndex === 6) return 'text-red-500';  // 日
  if (day && isPast(day)) return 'text-gray-300';
  return 'text-gray-700';
};
</script>

<template>
  <div class="agent-schedule-picker bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden select-none">
    <!-- Header bar -->
    <div class="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 flex items-center justify-between">
      <span class="text-white text-xs font-bold tracking-wider uppercase flex items-center gap-1.5">
        <Clock class="w-3.5 h-3.5" />
        エージェント面談日程選択
      </span>
      <span v-if="selectedDate" class="text-white/80 text-xs font-bold">
        {{ selectedDate.replace(/-/g, '/') }} {{ pad(selectedHour) }}:00
      </span>
    </div>

    <div class="p-4">
      <!-- Month navigation -->
      <div class="flex items-center justify-between mb-3">
        <button
          @click="prevMonth"
          type="button"
          class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
        >
          <ChevronLeft class="w-4 h-4" />
        </button>
        <span class="text-sm font-bold text-gray-800">{{ calendarTitle }}</span>
        <button
          @click="nextMonth"
          type="button"
          class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
        >
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>

      <!-- Day-of-week headers -->
      <div class="grid grid-cols-7 mb-1">
        <div
          v-for="(label, ci) in dayOfWeekLabels"
          :key="label"
          class="text-center text-[10px] font-bold pb-1"
          :class="ci === 5 ? 'text-blue-500' : ci === 6 ? 'text-red-500' : 'text-gray-400'"
        >
          {{ label }}
        </div>
      </div>

      <!-- Calendar grid -->
      <div class="grid grid-cols-7 gap-y-1">
        <button
          v-for="(day, idx) in calendarDays"
          :key="`cal-${idx}`"
          type="button"
          class="relative h-8 w-full flex items-center justify-center rounded-lg text-xs font-bold transition-all"
          :class="[
            day === null || isPast(day)
              ? 'cursor-default'
              : 'cursor-pointer hover:bg-indigo-50',
            isSelected(day ?? 0) && day !== null
              ? 'bg-indigo-600 shadow-md shadow-indigo-200'
              : '',
            isToday(day ?? 0) && day !== null && !isSelected(day ?? 0)
              ? 'ring-2 ring-indigo-400 ring-offset-1'
              : '',
          ]"
          :disabled="!day || isPast(day)"
          @click="selectDay(day)"
        >
          <span
            v-if="day"
            :class="dayTextColor(idx % 7, day, isSelected(day))"
          >{{ day }}</span>
        </button>
      </div>

      <!-- Time picker -->
      <div class="mt-4 pt-3 border-t border-gray-100">
        <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Clock class="w-3 h-3" />
          時間帯を選択
        </label>
        <div class="grid grid-cols-4 gap-1.5">
          <button
            v-for="h in hourOptions"
            :key="`h-${h}`"
            type="button"
            class="px-2 py-1.5 rounded-lg text-xs font-bold border transition-all"
            :class="selectedHour === h
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-200'"
            @click="selectedHour = h; emitValue()"
          >
            {{ pad(h) }}:00
          </button>
        </div>
      </div>

      <!-- Summary pill -->
      <div
        v-if="selectedDate"
        class="mt-4 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-2"
      >
        <span class="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0"></span>
        <span class="text-xs font-bold text-indigo-700">
          {{ selectedDate.replace(/-/g, '/') }}（{{ ['月','火','水','木','金','土','日'][new Date(selectedDate + 'T00:00').getDay() === 0 ? 6 : new Date(selectedDate + 'T00:00').getDay() - 1] }}）
          {{ pad(selectedHour) }}:00 〜 {{ pad(selectedHour + 1) }}:00
        </span>
      </div>
      <div v-else class="mt-4 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs text-gray-400 text-center">
        カレンダーから日付を選択してください
      </div>
    </div>
  </div>
</template>
