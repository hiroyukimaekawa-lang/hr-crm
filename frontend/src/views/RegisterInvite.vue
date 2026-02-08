<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { LogIn } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const token = ref(String(route.query.token || ''));
const username = ref('');
const name = ref('');
const password = ref('');
const error = ref('');
const success = ref('');

const register = async () => {
  try {
    error.value = '';
    success.value = '';
    const res = await axios.post('http://localhost:3000/api/auth/register-invite', {
      token: token.value,
      username: username.value,
      name: name.value,
      password: password.value
    });
    if (res.status === 201) {
      success.value = '登録が完了しました。ログインしてください。';
      setTimeout(() => router.push('/login'), 800);
    }
  } catch (err: any) {
    error.value = '登録に失敗しました。招待URLが有効か確認してください。';
  }
};
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md text-center">
      <h2 class="text-3xl font-extrabold text-gray-900 flex items-center justify-center gap-3">
        <LogIn class="w-8 h-8 text-blue-600" />
        担当者登録
      </h2>
      <p class="mt-2 text-sm text-gray-600">
        招待URLから担当者アカウントを作成します。
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border border-gray-100">
        <div class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700">招待トークン</label>
            <input v-model="token" type="text" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">ユーザー名</label>
            <input v-model="username" type="text" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">氏名</label>
            <input v-model="name" type="text" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">パスワード</label>
            <input v-model="password" type="password" class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm" />
          </div>

          <div v-if="error" class="text-red-600 text-sm text-center">{{ error }}</div>
          <div v-if="success" class="text-green-600 text-sm text-center">{{ success }}</div>

          <div>
            <button @click="register" class="w-full py-2 px-4 rounded-lg text-white bg-blue-600 hover:bg-blue-700">
              登録
            </button>
          </div>
        </div>
      </div>
      <p class="mt-4 text-center text-xs text-gray-400">
        &copy; 2026 Student CRM Trial. All rights reserved.
      </p>
    </div>
  </div>
</template>
