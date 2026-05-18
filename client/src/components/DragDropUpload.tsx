import { useRef, useState } from 'react';
import type { DragEvent, ChangeEvent } from 'react';

interface Props {
  accept?: string;          // e.g. 'image/*' or 'image/*,video/*'
  multiple?: boolean;       // allow picking/dropping multiple files
  onFiles: (files: File[]) => void;  // called with selected/dropped files
  title?: string;           // big label
  hint?: string;            // small helper text below the label
  icon?: string;            // emoji or text shown big in the middle
  height?: number | string;
  disabled?: boolean;
  uploadingLabel?: string;  // overrides title while uploading
  isUploading?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Reusable drop-zone + click-to-pick upload area. Works for single or
 * multi-file uploads. Renders with the existing `av2-upload-area` look
 * so it drops into the admin UI without restyle.
 */
const DragDropUpload = ({
  accept = 'image/*',
  multiple = false,
  onFiles,
  title = 'Drop file here',
  hint = 'or click to browse',
  icon = '＋',
  height = 'auto',
  disabled = false,
  uploadingLabel,
  isUploading = false,
  className = '',
  style,
}: Props) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const open = () => {
    if (disabled || isUploading) return;
    inputRef.current?.click();
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onFiles(files);
    // Reset so picking the same file twice still fires onChange
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDragEnter = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (disabled || isUploading) return;
    setDragOver(true);
  };
  const onDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
  };
  const onDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
  };
  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || isUploading) return;
    const files = Array.from(e.dataTransfer.files || [])
      .filter(f => {
        // crude type filter based on accept
        if (accept === '*' || accept === '*/*') return true;
        const types = accept.split(',').map(t => t.trim());
        return types.some(t => {
          if (t.endsWith('/*')) return f.type.startsWith(t.replace('/*', '/'));
          return f.type === t;
        });
      });
    if (files.length) onFiles(multiple ? files : [files[0]]);
  };

  return (
    <label
      className={`av2-upload-area ${dragOver ? 'is-dragover' : ''} ${className}`}
      onClick={open}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        cursor: disabled || isUploading ? 'wait' : 'pointer',
        height,
        position: 'relative',
        ...style,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={onInputChange}
        disabled={disabled || isUploading}
      />
      <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{isUploading ? '…' : icon}</span>
      <span style={{ fontSize: '0.84rem', marginTop: 6, fontWeight: 600 }}>
        {isUploading ? (uploadingLabel || 'Uploading…') : (dragOver ? 'Drop to upload' : title)}
      </span>
      {!isUploading && hint && (
        <span style={{ fontSize: '0.72rem', marginTop: 2, opacity: 0.7 }}>
          {hint}
        </span>
      )}
    </label>
  );
};

export default DragDropUpload;
