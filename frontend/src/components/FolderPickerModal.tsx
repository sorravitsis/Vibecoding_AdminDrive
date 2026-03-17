import React, { useState, useEffect } from 'react';
import { Folder, ChevronRight, X } from 'lucide-react';
import api from '../utils/api';
import '../styles/files.css';

interface FolderPickerModalProps {
  excludeFolderId?: string;
  onSelect: (folderId: string | null, name: string) => void;
  onClose: () => void;
}

const FolderPickerModal: React.FC<FolderPickerModalProps> = ({
  excludeFolderId,
  onSelect,
  onClose,
}) => {
  const [pathStack, setPathStack] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'My Drive' },
  ]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const currentFolder = pathStack[pathStack.length - 1];

  useEffect(() => {
    const fetchFolders = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/files?folderId=${currentFolder.id || ''}`);
        setFolders(
          res.data.filter(
            (item: any) =>
              item.type === 'folder' && item.folder_id !== excludeFolderId
          )
        );
      } catch (err) {
        console.error('Failed to fetch folders', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFolders();
  }, [currentFolder.id, excludeFolderId]);

  const enterFolder = (id: string, name: string) => {
    setPathStack([...pathStack, { id, name }]);
  };

  const navigateTo = (index: number) => {
    setPathStack(pathStack.slice(0, index + 1));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Move to...</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="folder-picker-breadcrumb">
          {pathStack.map((crumb, idx) => (
            <React.Fragment key={idx}>
              <span onClick={() => navigateTo(idx)}>{crumb.name}</span>
              {idx < pathStack.length - 1 && <ChevronRight size={14} />}
            </React.Fragment>
          ))}
        </div>

        <div className="folder-picker-list">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : folders.length === 0 ? (
            <div className="folder-picker-empty">No subfolders here</div>
          ) : (
            folders.map((folder, idx) => (
              <div
                key={idx}
                className="folder-picker-item"
                onDoubleClick={() => enterFolder(folder.folder_id, folder.name)}
              >
                <Folder size={18} className="icon-folder" />
                <span>{folder.name}</span>
              </div>
            ))
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => onSelect(currentFolder.id, currentFolder.name)}
          >
            Move Here
          </button>
        </div>
      </div>
    </div>
  );
};

export default FolderPickerModal;
