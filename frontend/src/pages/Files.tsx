import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Folder, File, MoreVertical, Download, Trash2, Share2, Plus, ChevronRight, Upload, X, Edit3, Eye,
  FileText, Image, Film, Music, FileSpreadsheet, FileCode, Archive, Search, Loader, FolderOpen,
  Star, Copy, FolderInput, Filter, ArrowUp, ArrowDown, CheckSquare, Square, Link, FolderDown,
} from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import FolderPickerModal from '../components/FolderPickerModal';
import FileInfoPanel from '../components/FileInfoPanel';
import '../styles/files.css';

interface FileItem {
  file_id?: string;
  folder_id?: string;
  google_file_id?: string;
  google_folder_id?: string;
  name: string;
  file_size?: string;
  mime_type?: string;
  created_at: string;
  type: 'file' | 'folder';
}

type SortField = 'name' | 'size' | 'date';
type SortDir = 'asc' | 'desc';

const FILE_TYPE_FILTERS: Record<string, string[]> = {
  All: [],
  Folders: ['folder'],
  Images: ['image/'],
  Videos: ['video/'],
  Audio: ['audio/'],
  PDF: ['application/pdf'],
  Documents: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml', 'text/'],
  Spreadsheets: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml'],
  Archives: ['application/zip', 'application/x-rar', 'application/gzip', 'application/x-7z'],
};

const getFileIcon = (mimeType?: string) => {
  if (!mimeType) return <File className="icon-file" size={20} />;
  if (mimeType.startsWith('image/')) return <Image className="icon-image" size={20} />;
  if (mimeType.startsWith('video/')) return <Film className="icon-video" size={20} />;
  if (mimeType.startsWith('audio/')) return <Music className="icon-audio" size={20} />;
  if (mimeType === 'application/pdf') return <FileText className="icon-pdf" size={20} />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet className="icon-sheet" size={20} />;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return <Archive className="icon-archive" size={20} />;
  if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('html') || mimeType.includes('css') || mimeType.includes('xml')) return <FileCode className="icon-code" size={20} />;
  return <File className="icon-file" size={20} />;
};

const isPreviewable = (mimeType?: string) => {
  if (!mimeType) return false;
  return mimeType === 'application/pdf' || mimeType.startsWith('image/');
};

const formatSize = (size?: string) => {
  if (!size) return '--';
  const bytes = parseInt(size);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const Files: React.FC = () => {
  const { showToast } = useToast();
  const [items, setItems] = useState<FileItem[]>([]);
  const [pathStack, setPathStack] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'My Drive' },
  ]);
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [shareModal, setShareModal] = useState<{id: string, name: string, type: 'file' | 'folder'} | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareAccess, setShareAccess] = useState('view');
  const [shareLoading, setShareLoading] = useState(false);
  const [previewModal, setPreviewModal] = useState<{id: string, name: string, mimeType: string} | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  // Confirm/Prompt modals
  const [confirmModal, setConfirmModal] = useState<{message: string, onConfirm: () => void} | null>(null);
  const [promptModal, setPromptModal] = useState<{title: string, defaultValue: string, onSubmit: (val: string) => void} | null>(null);
  const [promptValue, setPromptValue] = useState('');
  // Phase 2: Starred, Move, Info panel
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [moveModal, setMoveModal] = useState<{ open: boolean; item: FileItem | null }>({
    open: false,
    item: null,
  });
  const [infoPanelFileId, setInfoPanelFileId] = useState<string | null>(null);
  // Phase 4: Share link
  const [shareLinkModal, setShareLinkModal] = useState<{ fileId: string; name: string } | null>(null);
  const [shareLinkForm, setShareLinkForm] = useState({ expiresIn: '', password: '', maxDownloads: '' });
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [shareLinkLoading, setShareLinkLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase 1: Filter, Sort, Bulk
  const [filterType, setFilterType] = useState('All');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const currentFolder = pathStack[pathStack.length - 1];

  const fetchFiles = useCallback(async (folderId: string | null, search?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (folderId) params.set('folderId', folderId);
      if (search) params.set('search', search);

      const [filesRes, starredRes] = await Promise.all([
        api.get(`/files?${params.toString()}`),
        api.get('/files/starred').catch(() => ({ data: [] })),
      ]);
      setItems(filesRes.data);
      const ids = new Set<string>(starredRes.data.map((i: any) => i.id as string));
      setStarredIds(ids);
    } catch (err) {
      console.error('Failed to fetch files', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles(currentFolder.id, searchTerm);
    // Reset bulk mode on folder change
    setBulkMode(false);
    setSelectedIds(new Set());
  }, [currentFolder.id, fetchFiles]);

  useEffect(() => {
    const handleClick = () => setOpenMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (!previewModal) { setPreviewUrl(null); return; }
    let url: string | null = null;
    let cancelled = false;
    api.get(`/files/${previewModal.id}/preview`, { responseType: 'blob' })
      .then(res => {
        if (cancelled) return;
        url = URL.createObjectURL(res.data);
        setPreviewUrl(url);
      })
      .catch(() => { if (!cancelled) setPreviewUrl(null); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [previewModal]);

  // Filtered + sorted items
  const displayItems = useMemo(() => {
    let filtered = items;

    // Apply filter
    if (filterType !== 'All') {
      const mimePatterns = FILE_TYPE_FILTERS[filterType];
      if (mimePatterns[0] === 'folder') {
        filtered = filtered.filter(i => i.type === 'folder');
      } else {
        filtered = filtered.filter(
          i => i.type === 'file' && mimePatterns.some(p => (i.mime_type || '').startsWith(p))
        );
      }
    }

    // Sort: folders first, then by field
    const sorted = [...filtered].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === 'size') {
        cmp = (parseInt(a.file_size || '0') || 0) - (parseInt(b.file_size || '0') || 0);
      } else {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [items, filterType, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  // Bulk selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === displayItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayItems.map(i => (i.file_id || i.folder_id)!)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({
      message: `Move ${selectedIds.size} item(s) to recycle bin?`,
      onConfirm: async () => {
        try {
          const ops = displayItems
            .filter(i => selectedIds.has((i.file_id || i.folder_id)!))
            .map(i => {
              const id = (i.file_id || i.folder_id)!;
              const url = i.type === 'file' ? `/files/${id}` : `/files/folders/${id}`;
              return api.delete(url);
            });
          await Promise.all(ops);
          setSelectedIds(new Set());
          setBulkMode(false);
          showToast(`${selectedIds.size} item(s) deleted`, 'success');
          fetchFiles(currentFolder.id, searchTerm);
        } catch {
          showToast('Some items failed to delete', 'error');
        }
      }
    });
  };

  const handleToggleStar = async (e: React.MouseEvent, item: FileItem) => {
    e.stopPropagation();
    const id = (item.file_id || item.folder_id)!;
    const isStarred = starredIds.has(id);
    const url =
      item.type === 'file' ? `/files/${id}/star` : `/files/folders/${id}/star`;
    try {
      if (isStarred) {
        await api.delete(url);
        setStarredIds(prev => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        });
      } else {
        await api.post(url);
        setStarredIds(prev => new Set([...prev, id]));
      }
    } catch (err) {
      console.error('Failed to toggle star', err);
    }
  };

  const handleMove = async (destFolderId: string | null) => {
    const item = moveModal.item;
    if (!item) return;
    const id = (item.file_id || item.folder_id)!;
    const url =
      item.type === 'file' ? `/files/${id}/move` : `/files/folders/${id}/move`;
    try {
      await api.put(url, { destFolderId });
      setMoveModal({ open: false, item: null });
      showToast('Moved successfully', 'success');
      fetchFiles(currentFolder.id, searchTerm);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Move failed', 'error');
    }
  };

  const handleCopy = async (e: React.MouseEvent, item: FileItem) => {
    e.stopPropagation();
    try {
      await api.post(`/files/${item.file_id}/copy`);
      showToast('Copy created', 'success');
      fetchFiles(currentFolder.id, searchTerm);
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Copy failed', 'error');
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchFiles(currentFolder.id, term);
    }, 300);
  };

  const handleCreateFolder = () => {
    setPromptValue('');
    setPromptModal({
      title: 'New Folder',
      defaultValue: '',
      onSubmit: async (folderName) => {
        if (!folderName) return;
        try {
          setLoading(true);
          await api.post('/files/folders', { folderName, parentId: currentFolder.id });
          showToast(`Folder "${folderName}" created`, 'success');
          fetchFiles(currentFolder.id, searchTerm);
        } catch (err) {
          showToast('Failed to create folder', 'error');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const uploadSingleFile = async (file: globalThis.File) => {
    const formData = new FormData();
    formData.append('file', file);
    if (currentFolder.id) formData.append('folderId', currentFolder.id);
    await api.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setLoading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`Uploading ${i + 1}/${files.length}: ${files[i].name}`);
        await uploadSingleFile(files[i]);
      }
      fetchFiles(currentFolder.id, searchTerm);
      showToast(`${files.length} file(s) uploaded successfully!`, 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Upload failed', 'error');
    } finally {
      setLoading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    setLoading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`Uploading ${i + 1}/${files.length}: ${files[i].name}`);
        await uploadSingleFile(files[i]);
      }
      fetchFiles(currentFolder.id, searchTerm);
      showToast(`${files.length} file(s) uploaded successfully!`, 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Upload failed', 'error');
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    try {
      const response = await api.get(`/files/${fileId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showToast('Download failed', 'error');
    }
  };

  const handlePreview = (fileId: string, fileName: string, mimeType: string) => {
    setPreviewModal({ id: fileId, name: fileName, mimeType });
  };

  const handleDelete = (id: string, type: 'file' | 'folder') => {
    setConfirmModal({
      message: `Move this ${type} to recycle bin?`,
      onConfirm: async () => {
        try {
          if (type === 'file') await api.delete(`/files/${id}`);
          else await api.delete(`/files/folders/${id}`);
          showToast(`${type === 'file' ? 'File' : 'Folder'} moved to recycle bin`, 'success');
          fetchFiles(currentFolder.id, searchTerm);
        } catch (err) {
          showToast('Failed to delete', 'error');
        }
      }
    });
  };

  const handleRename = (id: string, type: 'file' | 'folder', currentName: string) => {
    setPromptValue(currentName);
    setPromptModal({
      title: `Rename ${type}`,
      defaultValue: currentName,
      onSubmit: async (newName) => {
        if (!newName || newName === currentName) return;
        try {
          if (type === 'file') await api.put(`/files/${id}/rename`, { newName });
          else await api.put(`/files/folders/${id}/rename`, { newName });
          showToast(`Renamed to "${newName}"`, 'success');
          fetchFiles(currentFolder.id, searchTerm);
        } catch (err: any) {
          showToast(err.response?.data?.error || 'Rename failed', 'error');
        }
      }
    });
  };

  const handleShare = async () => {
    if (!shareModal || !shareEmail) return;
    setShareLoading(true);
    try {
      if (shareModal.type === 'file') {
        await api.post(`/files/${shareModal.id}/share`, { email: shareEmail, accessLevel: shareAccess });
      } else {
        await api.post(`/files/folders/${shareModal.id}/share`, { email: shareEmail, accessLevel: shareAccess });
      }
      showToast(`Shared "${shareModal.name}" with ${shareEmail}`, 'success');
      setShareModal(null);
      setShareEmail('');
      setShareAccess('view');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Share failed', 'error');
    } finally {
      setShareLoading(false);
    }
  };

  const handleCreateShareLink = async () => {
    if (!shareLinkModal) return;
    setShareLinkLoading(true);
    try {
      const body: any = { fileId: shareLinkModal.fileId };
      if (shareLinkForm.expiresIn) body.expiresIn = parseInt(shareLinkForm.expiresIn);
      if (shareLinkForm.password) body.password = shareLinkForm.password;
      if (shareLinkForm.maxDownloads) body.maxDownloads = parseInt(shareLinkForm.maxDownloads);
      const res = await api.post('/share-links', body);
      const baseUrl = window.location.origin;
      setGeneratedLink(`${baseUrl}/share/${res.data.token}`);
      showToast('Share link created!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to create share link', 'error');
    } finally {
      setShareLinkLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      showToast('Link copied to clipboard', 'success');
    }
  };

  const handleDownloadFolder = async (folderId: string, folderName: string) => {
    try {
      showToast('Preparing ZIP download...', 'info');
      const response = await api.get(`/files/folders/${folderId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${folderName}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showToast('Download failed', 'error');
    }
  };

  const handleRowClick = (item: FileItem) => {
    if (bulkMode) {
      toggleSelect((item.file_id || item.folder_id)!);
      return;
    }
    if (item.type === 'file') {
      setInfoPanelFileId(prev =>
        prev === item.file_id ? null : item.file_id!
      );
    }
  };

  const enterFolder = (id: string, name: string) => { setSearchTerm(''); setPathStack([...pathStack, { id, name }]); };
  const navigateTo = (index: number) => { if (index < pathStack.length - 1) { setSearchTerm(''); setPathStack(pathStack.slice(0, index + 1)); } };
  const toggleMenu = (e: React.MouseEvent, id: string) => { e.stopPropagation(); setOpenMenu(openMenu === id ? null : id); };

  return (
    <div className={`page-content ${isDragging ? 'drag-active' : ''}`}
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} multiple />

      {isDragging && (
        <div className="drag-overlay">
          <Upload size={48} />
          <p>Drop files here to upload</p>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm</h3>
              <button className="modal-close" onClick={() => setConfirmModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{confirmModal.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Modal */}
      {promptModal && (
        <div className="modal-overlay" onClick={() => setPromptModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{promptModal.title}</h3>
              <button className="modal-close" onClick={() => setPromptModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <label>Name</label>
              <input className="modal-input" autoFocus value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { promptModal.onSubmit(promptValue); setPromptModal(null); } }} />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setPromptModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => { promptModal.onSubmit(promptValue); setPromptModal(null); }}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModal && (
        <div className="modal-overlay" onClick={() => setShareModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Share "{shareModal.name}"</h3>
              <button className="modal-close" onClick={() => setShareModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <label>Email address</label>
              <input type="email" placeholder="user@example.com" value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)} className="modal-input" />
              <label>Access level</label>
              <select value={shareAccess} onChange={(e) => setShareAccess(e.target.value)} className="modal-input">
                <option value="view">View only</option>
                <option value="edit">Can edit</option>
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShareModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={handleShare} disabled={shareLoading || !shareEmail}>
                {shareLoading ? 'Sharing...' : 'Share'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewModal && (
        <div className="modal-overlay preview-overlay" onClick={() => setPreviewModal(null)}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{previewModal.name}</h3>
              <div className="preview-actions">
                <button className="btn-secondary btn-sm" onClick={() => handleDownload(previewModal.id, previewModal.name)}>
                  <Download size={16} /> Download
                </button>
                <button className="modal-close" onClick={() => setPreviewModal(null)}><X size={20} /></button>
              </div>
            </div>
            <div className="preview-body">
              {!previewUrl ? (
                <div className="loading-spinner"><Loader size={24} className="spin" /><span>Loading preview...</span></div>
              ) : previewModal.mimeType === 'application/pdf' ? (
                <iframe src={previewUrl} title="PDF Preview" className="preview-iframe" />
              ) : previewModal.mimeType.startsWith('image/') ? (
                <img src={previewUrl} alt={previewModal.name} className="preview-image" />
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="files-header">
        <div className="breadcrumb">
          {pathStack.map((crumb, idx) => (
            <React.Fragment key={idx}>
              <span
                className={idx === pathStack.length - 1 ? 'breadcrumb-current' : 'breadcrumb-link'}
                onClick={() => navigateTo(idx)}
              >{crumb.name}</span>
              {idx < pathStack.length - 1 && <ChevronRight size={16} />}
            </React.Fragment>
          ))}
        </div>
        <div className="actions">
          <div className="search-box">
            <Search size={16} />
            <input type="text" placeholder="Search files..." value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)} />
          </div>

          {/* Filter dropdown */}
          <div className="filter-wrapper">
            <Filter size={16} />
            <select
              className="filter-select"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              {Object.keys(FILE_TYPE_FILTERS).map(key => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          </div>

          {/* Bulk select toggle */}
          <button
            className={`btn-secondary${bulkMode ? ' active' : ''}`}
            onClick={() => {
              setBulkMode(!bulkMode);
              setSelectedIds(new Set());
            }}
          >
            <CheckSquare size={18} />
            <span>{bulkMode ? 'Cancel' : 'Select'}</span>
          </button>

          {bulkMode && selectedIds.size > 0 && (
            <button className="btn-danger" onClick={handleBulkDelete}>
              <Trash2 size={18} />
              <span>Delete ({selectedIds.size})</span>
            </button>
          )}

          <button className="btn-primary" onClick={handleCreateFolder}><Plus size={18} /><span>New Folder</span></button>
          <button className="btn-secondary" onClick={handleUploadClick}><Upload size={18} /><span>Upload</span></button>
        </div>
      </div>

      {uploadProgress && <div className="upload-progress">{uploadProgress}</div>}

      <div className="files-grid">
        <div className="grid-header">
          <div className="col-name col-sortable" onClick={() => handleSort('name')}>
            {bulkMode && (
              <button className="bulk-checkbox" onClick={e => { e.stopPropagation(); toggleSelectAll(); }}>
                {selectedIds.size === displayItems.length && displayItems.length > 0
                  ? <CheckSquare size={16} />
                  : <Square size={16} />}
              </button>
            )}
            Name <SortIcon field="name" />
          </div>
          <div className="col-size col-sortable" onClick={() => handleSort('size')}>
            Size <SortIcon field="size" />
          </div>
          <div className="col-date col-sortable" onClick={() => handleSort('date')}>
            Created <SortIcon field="date" />
          </div>
          <div className="col-actions"></div>
        </div>

        {loading ? (
          <div className="loading-spinner"><Loader size={24} className="spin" /><span>Loading files...</span></div>
        ) : displayItems.length === 0 ? (
          <div className="empty-state-box">
            <FolderOpen size={48} />
            <p>{searchTerm ? 'No files match your search' : 'No files or folders here'}</p>
            <span>Upload files or create a folder to get started</span>
          </div>
        ) : (
          displayItems.map((item) => {
            const itemId = (item.file_id || item.folder_id)!;
            const isStarred = starredIds.has(itemId);
            const isInfoActive = infoPanelFileId === item.file_id;
            const isSelected = selectedIds.has(itemId);
            return (
              <div key={itemId}
                className={`grid-row${isInfoActive ? ' info-active' : ''}${isSelected ? ' selected' : ''}`}
                onClick={() => handleRowClick(item)}
                onDoubleClick={() => {
                  if (bulkMode) return;
                  if (item.type === 'folder') enterFolder(item.folder_id!, item.name);
                  else if (isPreviewable(item.mime_type)) handlePreview(item.file_id!, item.name, item.mime_type!);
                }}>
                <div className="col-name">
                  {bulkMode && (
                    <button className="bulk-checkbox" onClick={e => { e.stopPropagation(); toggleSelect(itemId); }}>
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                  )}
                  {item.type === 'folder' ? <Folder className="icon-folder" size={20} /> : getFileIcon(item.mime_type)}
                  <span>{item.name}</span>
                  {item.mime_type === 'application/pdf' && <span className="file-badge pdf">PDF</span>}
                  {!bulkMode && (
                    <button
                      className={`star-btn${isStarred ? ' starred' : ''}`}
                      onClick={e => handleToggleStar(e, item)}
                      title={isStarred ? 'Unstar' : 'Star'}
                    >
                      <Star size={14} />
                    </button>
                  )}
                </div>
                <div className="col-size">{formatSize(item.file_size)}</div>
                <div className="col-date">{new Date(item.created_at).toLocaleDateString()}</div>
                <div className="col-actions">
                  {!bulkMode && (
                    <div className="action-menu">
                      <button className="menu-trigger" onClick={(e) => toggleMenu(e, itemId)}><MoreVertical size={18} /></button>
                      {openMenu === itemId && (
                        <div className="dropdown show">
                          {item.type === 'file' && isPreviewable(item.mime_type) && (
                            <button onClick={() => { handlePreview(item.file_id!, item.name, item.mime_type!); setOpenMenu(null); }}>
                              <Eye size={14} /> Preview
                            </button>
                          )}
                          {item.type === 'file' && (
                            <button onClick={() => handleDownload(item.file_id!, item.name)}><Download size={14} /> Download</button>
                          )}
                          {item.type === 'file' && (
                            <button onClick={e => handleCopy(e, item)}>
                              <Copy size={14} /> Make a copy
                            </button>
                          )}
                          {item.type === 'folder' && (
                            <button onClick={() => { handleDownloadFolder(item.folder_id!, item.name); setOpenMenu(null); }}>
                              <FolderDown size={14} /> Download as ZIP
                            </button>
                          )}
                          <button onClick={() => { setShareModal({ id: itemId, name: item.name, type: item.type }); setOpenMenu(null); }}>
                            <Share2 size={14} /> Share
                          </button>
                          {item.type === 'file' && (
                            <button onClick={() => { setShareLinkModal({ fileId: item.file_id!, name: item.name }); setShareLinkForm({ expiresIn: '', password: '', maxDownloads: '' }); setGeneratedLink(null); setOpenMenu(null); }}>
                              <Link size={14} /> Get link
                            </button>
                          )}
                          <button onClick={() => { handleRename(itemId, item.type, item.name); setOpenMenu(null); }}>
                            <Edit3 size={14} /> Rename
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setMoveModal({ open: true, item });
                              setOpenMenu(null);
                            }}
                          >
                            <FolderInput size={14} /> Move to...
                          </button>
                          <button className="delete" onClick={() => handleDelete(itemId, item.type)}>
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {moveModal.open && moveModal.item && (
        <FolderPickerModal
          excludeFolderId={
            moveModal.item.type === 'folder'
              ? moveModal.item.folder_id
              : undefined
          }
          onSelect={destFolderId => handleMove(destFolderId)}
          onClose={() => setMoveModal({ open: false, item: null })}
        />
      )}

      {infoPanelFileId && (
        <FileInfoPanel
          fileId={infoPanelFileId}
          onClose={() => setInfoPanelFileId(null)}
        />
      )}

      {/* Share Link Modal */}
      {shareLinkModal && (
        <div className="modal-overlay" onClick={() => setShareLinkModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Share Link</h3>
              <button className="modal-close" onClick={() => setShareLinkModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 16px' }}>
                Create a shareable link for <strong>"{shareLinkModal.name}"</strong>
              </p>
              {!generatedLink ? (
                <>
                  <label>Expires after (hours, optional)</label>
                  <input className="modal-input" type="number" placeholder="e.g. 24, 72"
                    value={shareLinkForm.expiresIn}
                    onChange={e => setShareLinkForm({ ...shareLinkForm, expiresIn: e.target.value })} />
                  <label>Password protection (optional)</label>
                  <input className="modal-input" type="password" placeholder="Leave empty for no password"
                    value={shareLinkForm.password}
                    onChange={e => setShareLinkForm({ ...shareLinkForm, password: e.target.value })} />
                  <label>Max downloads (optional)</label>
                  <input className="modal-input" type="number" placeholder="e.g. 10"
                    value={shareLinkForm.maxDownloads}
                    onChange={e => setShareLinkForm({ ...shareLinkForm, maxDownloads: e.target.value })} />
                </>
              ) : (
                <div className="share-link-result">
                  <label>Share Link</label>
                  <div className="share-link-row">
                    <input className="modal-input" readOnly value={generatedLink} />
                    <button className="btn-primary btn-sm" onClick={handleCopyLink}>Copy</button>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShareLinkModal(null)}>
                {generatedLink ? 'Close' : 'Cancel'}
              </button>
              {!generatedLink && (
                <button className="btn-primary" onClick={handleCreateShareLink} disabled={shareLinkLoading}>
                  {shareLinkLoading ? 'Creating...' : 'Create Link'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Files;
