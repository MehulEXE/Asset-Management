const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const apiUrl = (path: string) => `${API_BASE}${path}`;

export default API_BASE;
