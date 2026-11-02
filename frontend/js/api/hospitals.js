// js/api/hospitals.js – Hospital API
import client from './client.js';

export const listHospitals   = (params)     => client.get('/hospitals/', { params });
export const getHospital     = (id)         => client.get(`/hospitals/${id}/`);
export const createHospital  = (data)       => client.post('/hospitals/', data);
export const updateHospital  = (id, data)   => client.patch(`/hospitals/${id}/`, data);
export const deleteHospital  = (id)         => client.delete(`/hospitals/${id}/`);
