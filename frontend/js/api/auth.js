// js/api/auth.js – Authentication API calls
import client from './client.js';

export const registerUser   = (data)    => client.post('/auth/register/', data);
export const loginUser      = (data)    => client.post('/auth/login/', data);
export const logoutUser     = (refresh) => client.post('/auth/logout/', { refresh });
export const getMe          = ()        => client.get('/auth/me/');
export const updateMe       = (data)    => client.patch('/auth/me/', data);
export const changePassword = (data)    => client.put('/auth/change-password/', data);
