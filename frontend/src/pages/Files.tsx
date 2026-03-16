import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Folder, File, MoreVertical, Download, Trash2, Share2, Plus, ChevronRight, Upload, X, Edit3, Eye,
  FileText, Image, Film, Music, FileSpreadsheet, FileCode, Archive, Search
} from 'lucide-react';
import api from '../utils/api';
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

const Files: React.FC = () => {
  const [items, setItems] = useState<FileItem[]>([]);
  const [pathStack, setPathStack] = useState<{id: string | null, name: string}[]>([{id: null, name: 'My Drive'}]);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentFolder = pathStack[pathStack.length - 1];

  const fetchFiles = useCallback(async (folderId: string | null, search?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (folderId) params.set('folderId', folderId);
      if (search) params.set('search', search);
      const response = await api.get(`/files?${params.toString()}`);
      setItems(response.data);
    } catch (err) {
      console.error('Failed to fetch files', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiles(currentFolder.id, searchTerm); }, [currentFolder.id, fetchFiles]);

  useEffect(() => {
    const handleClick = () => setOpenMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Blob-based preview (no token in URL)
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

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchFiles(currentFolder.id, term);
    }, 300);
  };

  const handleCreateFolder = async () => {
    const folderName = prompt('Enter folder name:');
    if (!folderName) return;
    try {
      setLoading(true);
      await api.post('/files/folders', { folderName, parentId: currentFolder.id });
      fetchFiles(currentFolder.id, searchTerm);
    } catch (err) {
      alert('Failed to create folder');
    } finally {
      setLoading(false);
    }
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
      alert(`${files.length} file(s) uploaded successfully!`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag & drop
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
      alert(`${files.length} file(s) uploaded successfully!`);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Upload failed');
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
      alert('Download failed');
    }
  };

  const handlePreview = (fileId: string, fileName: string, mimeType: string) => {
    setPreviewModal({ id: fileId, name: fileName, mimeType });
  };

  const handleDelete = async (id: string, type: 'file' | 'folder') => {
    if (window.confirm(`Move this ${type} to recycle bin?`)) {
      try {
        if (type === 'file') await api.delete(`/files/${id}`);
        else await api.delete(`/files/folders/${id}`);
        fetchFiles(currentFolder.id, searchTerm);
      } catch (err) {
        alert('Failed to delete');
      }
    }
  };

  const handleRename = async (id: string, type: 'file' | 'folder', currentName: string) => {
    const newName = prompt('Enter new name:', currentName);
    if (!newName || newName === currentName) return;
    try {
      if (type === 'file') await api.put(`/files/${id}/rename`, { newName });
      else await api.put(`/files/folders/${id}/rename`, { newName });
      fetchFiles(currentFolder.id, searchTerm);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Rename failed');
    }
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
      alert(`Shared "${shareModal.name}" with ${shareEmail}`);
      setShareModal(null);
      setShareEmail('');
      setShareAccess('view');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Share failed');
    } finally {
      setShareLoading(false);
    }
  };

  const enterFolder = (id: string, name: string) => { setSearchTerm(''); setPathStack([...pathStack, { id, name }]); };
  const navigateTo = (index: number) => { setSearchTerm(''); setPathStack(pathStack.slice(0, index + 1)); };
  const toggleMenu = (e: React.MouseEvent, id: string) => { e.stopPropagation(); setOpenMenu(openMenu === id ? null : id); };

  const formatSize = (size?: string) => {
    if (!size) return '--';
    const bytes = parseInt(size);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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

      {/* Preview Modal (blob-based, secure) */}
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
                <div className="loading">Loading preview...</div>
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
              <span onClick={() => navigateTo(idx)}>{crumb.name}</span>
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
          <button className="btn-primary" onClick={handleCreateFolder}><Plus size={18} /><span>New Folder</span></button>
          <button className="btn-secondary" onClick={handleUploadClick}><Upload size={18} /><span>Upload</span></button>
        </div>
      </div>

      {uploadProgress && <div className="upload-progress">{uploadProgress}</div>}

      <div className="files-grid">
        <div className="grid-header">
          <div className="col-name">Name</div>
          <div className="col-size">Size</div>
          <div className="col-date">Created</div>
          <div className="col-actions"></div>
        </div>

        {loading ? (
          <div className="loading">Processing...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">{searchTerm ? 'No files match your search' : 'No files or folders here'}</div>
        ) : (
          items.map((item) => {
            const itemId = (item.file_id || item.folder_id)!;
            return (
              <div key={itemId} className="grid-row"
                onDoubleClick={() => {
                  if (item.type === 'folder') enterFolder(item.folder_id!, item.name);
                  else if (isPreviewable(item.mime_type)) handlePreview(item.file_id!, item.name, item.mime_type!);
                }}>
                <div className="col-name">
                  {item.type === 'folder' ? <Folder className="icon-folder" size={20} /> : getFileIcon(item.mime_type)}
                  <span>{item.name}</span>
                  {item.mime_type === 'application/pdf' && <span className="file-badge pdf">PDF</span>}
                </div>
                <div className="col-size">{formatSize(item.file_size)}</div>
                <div className="col-date">{new Date(item.created_at).toLocaleDateString()}</div>
                <div className="col-actions">
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
                        <button onClick={() => { setShareModal({ id: itemId, name: item.name, type: item.type }); setOpenMenu(null); }}>
                          <Share2 size={14} /> Share
                        </button>
                        <button onClick={() => { handleRename(itemId, item.type, item.name); setOpenMenu(null); }}>
                          <Edit3 size={14} /> Rename
                        </button>
                        <button className="delete" onClick={() => handleDelete(itemId, item.type)}>
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Files;
