const API_BASE = import.meta.env.VITE_API_URL || 'https://asset-management-gciq.onrender.com';

export const apiUrl = (path: string) => `${API_BASE}${path}`;

export default API_BASE;
