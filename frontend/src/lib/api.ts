import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.PROD ? '/api' : 'http://localhost:3000');

export const api = axios.create({
  baseURL: API_BASE
});
