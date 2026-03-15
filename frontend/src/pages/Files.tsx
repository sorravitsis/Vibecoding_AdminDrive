import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, 
  File, 
  MoreVertical, 
  Download, 
  Trash2, 
  Share2, 
  Plus, 
  ChevronRight,
  Upload
} from 'lucide-react';
import api from '../utils/api';
import '../styles/files.css';

interface FileItem {
  file_id?: string;
  folder_id?: string;
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

  useEffect(() => {
    fetchFiles(currentFolder.id);
  }, [currentFolder.id]);

  const handleCreateFolder = async () => {
    const folderName = prompt('Enter folder name:');
    if (!folderName) return;

    try {
      setLoading(true);
      await api.post('/files/folders', { 
        folderName, 
        parentId: currentFolder.id 
      });
      fetchFiles(currentFolder.id);
    } catch (err) {
      alert('Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (currentFolder.id) formData.append('folderId', currentFolder.id);

    try {
      setLoading(true);
      await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchFiles(currentFolder.id);
      alert('File uploaded successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, type: 'file' | 'folder') => {
    if (window.confirm(`Move this ${type} to recycle bin?`)) {
      try {
        if (type === 'file') {
          await api.delete(`/files/${id}`);
        } else {
          await api.delete(`/files/folders/${id}`);
        }
        fetchFiles(currentFolder.id);
      } catch (err) {
        alert('Failed to delete');
      }
    }
  };

  const enterFolder = (id: string, name: string) => {
    setPathStack([...pathStack, { id, name }]);
  };

  const navigateTo = (index: number) => {
    setPathStack(pathStack.slice(0, index + 1));
  };

  return (
    <div className="page-content">
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileChange} 
      />
      
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
          <button className="btn-primary" onClick={handleCreateFolder}>
            <Plus size={18} />
            <span>New Folder</span>
          </button>
          <button className="btn-secondary" onClick={handleUploadClick}>
            <Upload size={18} />
            <span>Upload File</span>
          </button>
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
          items.map((item, idx) => (
            <div 
              key={idx} 
              className="grid-row" 
              onDoubleClick={() => item.type === 'folder' && enterFolder(item.folder_id!, item.name)}
            >
              <div className="col-name">
                {item.type === 'folder' ? <Folder className="icon-folder" size={20} /> : <File className="icon-file" size={20} />}
                <span>{item.name}</span>
              </div>
              <div className="col-size">
                {item.file_size ? `${(parseInt(item.file_size) / 1024).toFixed(1)} KB` : '--'}
              </div>
              <div className="col-date">
                {new Date(item.created_at).toLocaleDateString()}
              </div>
              <div className="col-actions">
                <div className="action-menu">
                  <MoreVertical size={18} />
                  <div className="dropdown">
                    {item.type === 'file' && <button><Download size={14} /> Download</button>}
                    <button><Share2 size={14} /> Share</button>
                    <button 
                      className="delete" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete((item.file_id || item.folder_id)!, item.type);
                      }}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Files;
