<script setup lang="ts">
import { ref } from 'vue'
import { api } from '../lib/api'
import { STATUS_CONFIG, getStatusLabel, getStatusBadgeClass } from '../lib/statusConfig'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: boolean
  studentName: string
  eventTitle: string
  eventId: number
  studentEventId: number
  currentStatus: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'updated': [newStatus: string]
}>()

const saving = ref(false)
const selectedStatus = ref(props.currentStatus)

const availableStatuses: Array<keyof typeof STATUS_CONFIG & string> = [
  'A_ENTRY', 'B_WAITING', 'C_WAITING',
  'attended', 'D_PASS', 'E_FAIL', 'XA_CANCEL'
]

const update = async () => {
  if (saving.value || selectedStatus.value === props.currentStatus) return
  saving.value = true
  try {
    const token = localStorage.getItem('token')
    await api.put(
      `/api/events/${props.eventId}/participants/${props.studentEventId}`,
      { status: selectedStatus.value },
      { headers: { Authorization: token } }
    )
    emit('updated', selectedStatus.value)
    emit('update:modelValue', false)
  } finally {
    saving.value = false
  }
}

const close = () => emit('update:modelValue', false)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
      @click.self="close"
    >
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="text-xs text-gray-500">{{ eventTitle }}</p>
            <p class="text-base font-bold text-gray-900">{{ studentName }}</p>
          </div>
          <button @click="close" class="text-gray-400 hover:text-gray-600">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="mb-4">
          <p class="text-xs text-gray-500 mb-1">現在のステータス</p>
          <span
            class="text-xs font-bold px-3 py-1 rounded-full border"
            :class="getStatusBadgeClass(currentStatus)"
          >{{ getStatusLabel(currentStatus) }}</span>
        </div>
        <div class="mb-6">
          <p class="text-xs text-gray-500 mb-2">変更後のステータス</p>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="status in availableStatuses"
              :key="status"
              @click="selectedStatus = status"
              class="px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition-all"
              :class="selectedStatus === status
                ? `${STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.bgClass || ''} text-white border-transparent`
                : `bg-white ${STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.textClass || ''} ${STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.borderClass || ''}`"
            >{{ getStatusLabel(status) }}</button>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            @click="close"
            class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >キャンセル</button>
          <button
            @click="update"
            :disabled="saving || selectedStatus === currentStatus"
            class="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40"
          >{{ saving ? '更新中...' : '更新する' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
