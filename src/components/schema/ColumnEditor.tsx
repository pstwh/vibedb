import React, { useState, useEffect, useRef } from 'react';
import { Column, Table } from '@/types';

interface ColumnEditorProps {
  table: Table;
  column: Column;
  position: { x: number; y: number };
  onSave: (tableId: string, columnId: string, updatedColumn: Column) => void;
  onClose: () => void;
}

const ColumnEditor: React.FC<ColumnEditorProps> = ({ table, column, position, onSave, onClose }) => {
  const [name, setName] = useState(column.name);
  const [type, setType] = useState(column.type);
  const [isPrimaryKey, setIsPrimaryKey] = useState(column.isPrimaryKey);
  const [isNotNull, setIsNotNull] = useState(column.constraints.includes('NOT NULL'));
  const [isUnique, setIsUnique] = useState(column.constraints.includes('UNIQUE'));
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editorRef.current && !editorRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);
  
  const handleSave = () => {
    let newConstraints = column.constraints.filter(c => c !== 'NOT NULL' && c !== 'UNIQUE');
    
    if (isNotNull) {
      newConstraints.push('NOT NULL');
    }
    if (isUnique) {
      newConstraints.push('UNIQUE');
    }
    
    newConstraints = [...new Set(newConstraints)];

    const updatedColumn: Column = {
      ...column,
      name,
      type,
      isPrimaryKey,
      constraints: newConstraints,
    };
    onSave(table.id!, column.id!, updatedColumn);
    onClose();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      ref={editorRef}
      className="absolute z-30 bg-gray-700 p-4 rounded-lg shadow-2xl border border-gray-600 w-64"
      style={{ top: position.y + 10, left: position.x + 10 }}
      onKeyDown={handleKeyDown}
    >
      <h3 className="text-lg font-bold mb-3 text-white">Edit Column</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-800 p-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Data Type</label>
          <input
            type="text"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full bg-gray-800 p-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
           <label htmlFor="is-pk" className="flex items-center space-x-2 cursor-pointer">
              <input id="is-pk" type="checkbox" checked={isPrimaryKey} onChange={(e) => setIsPrimaryKey(e.target.checked)} className="h-4 w-4 rounded bg-gray-800 border-gray-600 text-blue-600 focus:ring-blue-500"/>
              <span className="text-sm font-medium text-gray-300">Primary Key</span>
           </label>
           <label htmlFor="is-nn" className="flex items-center space-x-2 cursor-pointer">
              <input id="is-nn" type="checkbox" checked={isNotNull} onChange={(e) => setIsNotNull(e.target.checked)} className="h-4 w-4 rounded bg-gray-800 border-gray-600 text-blue-600 focus:ring-blue-500"/>
              <span className="text-sm font-medium text-gray-300">Not Null</span>
           </label>
           <label htmlFor="is-uq" className="flex items-center space-x-2 cursor-pointer">
              <input id="is-uq" type="checkbox" checked={isUnique} onChange={(e) => setIsUnique(e.target.checked)} className="h-4 w-4 rounded bg-gray-800 border-gray-600 text-blue-600 focus:ring-blue-500"/>
              <span className="text-sm font-medium text-gray-300">Unique</span>
           </label>
        </div>
        <div className="flex justify-end space-x-2 pt-2">
          <button onClick={onClose} className="px-3 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white font-semibold">Cancel</button>
          <button onClick={handleSave} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold">Save</button>
        </div>
      </div>
    </div>
  );
};

export default ColumnEditor;


