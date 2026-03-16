import React, { useState, useEffect, useRef } from 'react';
import {
  Folder, File, MoreVertical, Download, Trash2, Share2, Plus, ChevronRight, Upload, X, Edit3
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

const Files: React.FC = () => {
  const [items, setItems] = useState<FileItem[]>([]);
  const [pathStack, setPathStack] = useState<{id: string | null, name: string}[]>([{id: null, name: 'My Drive'}]);
  const [loading, setLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [shareModal, setShareModal] = useState<{id: string, name: string, type: 'file' | 'folder'} | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareAccess, setShareAccess] = useState('view');
  const [shareLoading, setShareLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFolder = pathStack[pathStack.length - 1];

  const fetchFiles = async (folderId: string | null) => {
    setLoading(true);
    try {
      const response = await api.get(`/files?folderId=${folderId || ''}`);
      setItems(response.data);
    } catch (err) {
      console.error('Failed to fetch files', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFiles(currentFolder.id); }, [currentFolder.id]);
  useEffect(() => {
    const handleClick = () => setOpenMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleCreateFolder = async () => {
    const folderName = prompt('Enter folder name:');
    if (!folderName) return;
    try {
      setLoading(true);
      await api.post('/files/folders', { folderName, parentId: currentFolder.id });
      fetchFiles(currentFolder.id);
    } catch (err) {
      alert('Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    if (currentFolder.id) formData.append('folderId', currentFolder.id);
    try {
      setLoading(true);
      await api.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      fetchFiles(currentFolder.id);
      alert('File uploaded successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  const handleDelete = async (id: string, type: 'file' | 'folder') => {
    if (window.confirm(`Move this ${type} to recycle bin?`)) {
      try {
        if (type === 'file') await api.delete(`/files/${id}`);
        else await api.delete(`/files/folders/${id}`);
        fetchFiles(currentFolder.id);
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
      fetchFiles(currentFolder.id);
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

  const enterFolder = (id: string, name: string) => setPathStack([...pathStack, { id, name }]);
  const navigateTo = (index: number) => setPathStack(pathStack.slice(0, index + 1));
  const toggleMenu = (e: React.MouseEvent, id: string) => { e.stopPropagation(); setOpenMenu(openMenu === id ? null : id); };

  return (
    <div className="page-content">
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />

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
          <button className="btn-primary" onClick={handleCreateFolder}><Plus size={18} /><span>New Folder</span></button>
          <button className="btn-secondary" onClick={handleUploadClick}><Upload size={18} /><span>Upload File</span></button>
        </div>
      </div>

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
          <div className="empty-state">No files or folders here</div>
        ) : (
          items.map((item) => {
            const itemId = (item.file_id || item.folder_id)!;
            return (
              <div key={itemId} className="grid-row"
                onDoubleClick={() => item.type === 'folder' && enterFolder(item.folder_id!, item.name)}>
                <div className="col-name">
                  {item.type === 'folder' ? <Folder className="icon-folder" size={20} /> : <File className="icon-file" size={20} />}
                  <span>{item.name}</span>
                </div>
                <div className="col-size">
                  {item.file_size ? `${(parseInt(item.file_size) / 1024).toFixed(1)} KB` : '--'}
                </div>
                <div className="col-date">{new Date(item.created_at).toLocaleDateString()}</div>
                <div className="col-actions">
                  <div className="action-menu">
                    <button className="menu-trigger" onClick={(e) => toggleMenu(e, itemId)}><MoreVertical size={18} /></button>
                    {openMenu === itemId && (
                      <div className="dropdown show">
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
