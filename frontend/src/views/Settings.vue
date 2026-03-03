<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Layout from '../components/Layout.vue';
import { api } from '../lib/api';

interface SourceCategory {
  id: number;
  name: string;
  created_at: string;
}

const user = JSON.parse(localStorage.getItem('user') || '{"role":"staff"}');
const categories = ref<SourceCategory[]>([]);
const newCategoryName = ref('');
const message = ref('');

const fetchCategories = async () => {
  const token = localStorage.getItem('token');
  const res = await api.get('/api/students/source-categories', { headers: { Authorization: token } });
  categories.value = Array.isArray(res.data) ? res.data : [];
};

const addCategory = async () => {
  if (!newCategoryName.value.trim()) return;
  const token = localStorage.getItem('token');
  await api.post('/api/students/source-categories', { name: newCategoryName.value.trim() }, { headers: { Authorization: token } });
  newCategoryName.value = '';
  message.value = '流入経路カテゴリを保存しました。';
  await fetchCategories();
};

const deleteCategory = async (id: number) => {
  if (!confirm('このカテゴリを削除しますか？')) return;
  const token = localStorage.getItem('token');
  await api.delete(`/api/students/source-categories/${id}`, { headers: { Authorization: token } });
  message.value = 'カテゴリを削除しました。';
  await fetchCategories();
};

onMounted(fetchCategories);
</script>

<template>
  <Layout>
    <div class="p-4 md:p-6 lg:p-8">
      <h1 class="text-2xl font-bold text-gray-900 mb-2">設定</h1>
      <p class="text-sm text-gray-500 mb-6">流入経路カテゴリを管理できます。</p>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">流入経路カテゴリ登録</h2>
        <p v-if="user.role !== 'admin'" class="text-sm text-gray-500">閲覧のみ可能です（管理者のみ追加・削除可能）。</p>
        <div class="flex gap-2 max-w-xl">
          <input
            v-model="newCategoryName"
            type="text"
            placeholder="例: オービック"
            class="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
            :disabled="user.role !== 'admin'"
          />
          <button
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            :disabled="user.role !== 'admin'"
            @click="addCategory"
          >
            追加
          </button>
        </div>
        <p v-if="message" class="text-sm text-green-600 mt-2">{{ message }}</p>
      </div>

      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-3">登録済みカテゴリ</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 border-b border-gray-200">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">カテゴリ名</th>
                <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">登録日</th>
                <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="c in categories" :key="c.id">
                <td class="px-3 py-2 text-gray-900">{{ c.name }}</td>
                <td class="px-3 py-2 text-gray-600">{{ new Date(c.created_at).toLocaleDateString('ja-JP') }}</td>
                <td class="px-3 py-2 text-right">
                  <button
                    class="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    :disabled="user.role !== 'admin'"
                    @click="deleteCategory(c.id)"
                  >
                    削除
                  </button>
                </td>
              </tr>
              <tr v-if="categories.length === 0">
                <td colSpan="3" class="px-3 py-8 text-center text-gray-400">カテゴリが未登録です。</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </Layout>
</template>

