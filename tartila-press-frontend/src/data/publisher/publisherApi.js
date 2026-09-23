// src/features/publisher/api/publisherApi.js
//
// Sesuaikan import `http` ini dengan instance axios yang sudah ada di
// project Anda (yang sudah pasang base URL + header Authorization).
// Kalau belum ada, ganti baris di bawah dengan axios biasa + baseURL.
import http from '@/lib/http';

const BASE = '/v1/publisher';

// ---------- Layout: Templates ----------
export const listTemplates = (params) =>
  http.get(`${BASE}/layout/templates`, { params }).then((r) => r.data);

export const getTemplate = (id) =>
  http.get(`${BASE}/layout/templates/${id}`).then((r) => r.data);

export const createTemplate = (payload) =>
  http.post(`${BASE}/layout/templates`, payload).then((r) => r.data);

export const updateTemplate = (id, payload) =>
  http.patch(`${BASE}/layout/templates/${id}`, payload).then((r) => r.data);

export const deleteTemplate = (id) =>
  http.delete(`${BASE}/layout/templates/${id}`);

export const getPageNumbering = (templateId) =>
  http.get(`${BASE}/layout/templates/${templateId}/page-numbering`).then((r) => r.data);

export const updatePageNumbering = (templateId, payload) =>
  http.put(`${BASE}/layout/templates/${templateId}/page-numbering`, payload).then((r) => r.data);

// ---------- Draft Editing: Manuscripts ----------
export const listManuscripts = (params) =>
  http.get(`${BASE}/draft/manuscripts`, { params }).then((r) => r.data);

export const getManuscript = (id) =>
  http.get(`${BASE}/draft/manuscripts/${id}`).then((r) => r.data);

export const createManuscript = (payload) =>
  http.post(`${BASE}/draft/manuscripts`, payload).then((r) => r.data);

export const updateManuscript = (id, payload) =>
  http.patch(`${BASE}/draft/manuscripts/${id}`, payload).then((r) => r.data);

export const deleteManuscript = (id) =>
  http.delete(`${BASE}/draft/manuscripts/${id}`);

export const publishManuscript = (id, payload) =>
  http.post(`${BASE}/draft/manuscripts/${id}/publish`, payload).then((r) => r.data);

// ---------- Draft Editing: Chapters ----------
export const listChapters = (manuscriptId) =>
  http.get(`${BASE}/draft/manuscripts/${manuscriptId}/chapters`).then((r) => r.data);

export const createChapter = (manuscriptId, payload) =>
  http.post(`${BASE}/draft/manuscripts/${manuscriptId}/chapters`, payload).then((r) => r.data);

export const updateChapter = (manuscriptId, chapterId, payload) =>
  http
    .patch(`${BASE}/draft/manuscripts/${manuscriptId}/chapters/${chapterId}`, payload)
    .then((r) => r.data);

export const deleteChapter = (manuscriptId, chapterId) =>
  http.delete(`${BASE}/draft/manuscripts/${manuscriptId}/chapters/${chapterId}`);

export const reorderChapters = (manuscriptId, orderedIds) =>
  http
    .put(`${BASE}/draft/manuscripts/${manuscriptId}/chapters/reorder`, { order: orderedIds })
    .then((r) => r.data);

// ---------- Draft Editing: Content Blocks ----------
export const listBlocks = (chapterId) =>
  http.get(`${BASE}/draft/chapters/${chapterId}/blocks`).then((r) => r.data);

export const createBlock = (chapterId, payload) =>
  http.post(`${BASE}/draft/chapters/${chapterId}/blocks`, payload).then((r) => r.data);

export const updateBlock = (chapterId, blockId, payload) =>
  http.patch(`${BASE}/draft/chapters/${chapterId}/blocks/${blockId}`, payload).then((r) => r.data);

export const deleteBlock = (chapterId, blockId) =>
  http.delete(`${BASE}/draft/chapters/${chapterId}/blocks/${blockId}`);

export const reorderBlocks = (chapterId, orderedIds) =>
  http
    .put(`${BASE}/draft/chapters/${chapterId}/blocks/reorder`, { order: orderedIds })
    .then((r) => r.data);

// ---------- Draft Editing: References ----------
export const listReferences = (manuscriptId) =>
  http.get(`${BASE}/draft/manuscripts/${manuscriptId}/references`).then((r) => r.data);

export const createReference = (manuscriptId, payload) =>
  http.post(`${BASE}/draft/manuscripts/${manuscriptId}/references`, payload).then((r) => r.data);

export const updateReference = (manuscriptId, referenceId, payload) =>
  http
    .patch(`${BASE}/draft/manuscripts/${manuscriptId}/references/${referenceId}`, payload)
    .then((r) => r.data);

export const deleteReference = (manuscriptId, referenceId) =>
  http.delete(`${BASE}/draft/manuscripts/${manuscriptId}/references/${referenceId}`);
