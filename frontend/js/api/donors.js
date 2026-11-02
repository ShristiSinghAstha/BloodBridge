// js/api/donors.js – Donor profile and history API
import client from './client.js';

export const getMyDonorProfile    = ()          => client.get('/donors/profiles/me/');
export const createDonorProfile   = (data)      => client.post('/donors/profiles/', data);
export const updateMyDonorProfile = (data)      => client.patch('/donors/profiles/me/', data);
export const setAvailability      = (avail)     => client.patch('/donors/profiles/availability/', { availability: avail });
export const listDonors           = (params)    => client.get('/donors/profiles/', { params });
export const getDonor             = (id)        => client.get(`/donors/profiles/${id}/`);
export const updateDonor          = (id, data)  => client.patch(`/donors/profiles/${id}/`, data);
export const getDonationHistory   = ()          => client.get('/donors/history/');
