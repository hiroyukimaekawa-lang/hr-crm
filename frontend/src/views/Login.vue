<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../lib/api';
import { useRouter } from 'vue-router';
import { LogIn } from 'lucide-vue-next';

const username = ref('admin'); // prefill for convenience
const password = ref('password');
const router = useRouter();
const error = ref('');

const login = async () => {
  try {
    const res = await api.post('/api/auth/login', {
      username: username.value,
      password: password.value
    });
    
    if (res.data.token) {
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      router.push('/students');
    }
  } catch (err: any) {
    error.value = 'ログインに失敗しました';
    console.error(err);
  }
};
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md text-center">
      <h2 class="text-3xl font-extrabold text-gray-900 flex items-center justify-center gap-3">
        <LogIn class="w-8 h-8 text-blue-600" />
        学生CRM
      </h2>
      <p class="mt-2 text-sm text-gray-600">
        イベント送客・学生管理システム
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border border-gray-100">
        <div class="space-y-6">
          <div>
            <label for="username" class="block text-sm font-medium text-gray-700">ユーザー名</label>
            <div class="mt-1">
              <input 
                v-model="username"
                id="username"
                type="text" 
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base md:text-sm"
              >
            </div>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">パスワード</label>
            <div class="mt-1">
              <input 
                v-model="password"
                id="password"
                type="password" 
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base md:text-sm"
              >
            </div>
          </div>

          <div v-if="error" class="text-red-600 text-sm text-center">
            {{ error }}
          </div>

          <div>
            <button 
              @click="login"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-base md:text-sm min-h-[44px] font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              ログイン
            </button>
          </div>
        </div>
        
        <div class="mt-6">
            <div class="relative">
                <div class="absolute inset-0 flex items-center">
                    <div class="w-full border-t border-gray-300"></div>
                </div>
                <div class="relative flex justify-center text-sm">
                    <span class="px-2 bg-white text-gray-500">
                        トライアル用
                    </span>
                </div>
            </div>
        </div>
      </div>
      <p class="mt-4 text-center text-xs text-gray-400">
        &copy; 2026 Student CRM Trial. All rights reserved.
      </p>
    </div>
  </div>
</template>
