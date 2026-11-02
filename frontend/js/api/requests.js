// js/api/requests.js – Blood request and donor response API
import client from './client.js';

export const createBloodRequest   = (data)   => client.post('/requests/blood/', data);
export const listBloodRequests    = (params) => client.get('/requests/blood/', { params });
export const getBloodRequest      = (id)     => client.get(`/requests/blood/${id}/`);
export const cancelBloodRequest   = (id)     => client.post(`/requests/blood/${id}/cancel/`);
export const fulfillBloodRequest  = (id, data) => client.post(`/requests/blood/${id}/fulfill/`, data);
export const getMatchingDonors    = (id)     => client.get(`/requests/blood/${id}/matches/`);
export const getRequestResponses  = (id)     => client.get(`/requests/blood/${id}/responses/`);

export const listDonorResponses   = ()       => client.get('/requests/responses/');
export const acceptResponse       = (id)     => client.post(`/requests/responses/${id}/accept/`);
export const rejectResponse       = (id)     => client.post(`/requests/responses/${id}/reject/`);
