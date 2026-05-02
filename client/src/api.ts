export const SERVER_URL = 'http://localhost:5000';
const API_URL = `${SERVER_URL}/api`;

export const getConfig = async () => {
  const response = await fetch(`${API_URL}/config`);
  return response.json();
};

export const login = async (password: string) => {
  const response = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return response.json();
};

export const updateConfig = async (config: any) => {
  const response = await fetch(`${API_URL}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return response.json();
};

export const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append('image', file);
  const response = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    body: formData,
  });
  return response.json();
};
