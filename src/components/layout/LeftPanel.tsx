import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Schema, Table, Column, Project } from '@/types';

interface ExplorerPanelProps {
  projects: Project[];
  activeProjectId: string | null;
  onSwitchProject: (id: string) => void;
  onNewProject: () => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, newName: string) => void;
  schema: Schema | null;
  onUpdateTable: (tableId: string, newName: string) => void;
  onAddColumn: (tableId: string) => void;
  onDeleteColumn: (tableId: string, columnId: string) => void;
  onDeleteTable: (tableId: string) => void;
  onOpenColumnEditor: (table: Table, column: Column, position: { x: number, y: number }) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const ProjectSwitcher: React.FC<Omit<ExplorerPanelProps, 'schema' | 'onUpdateTable' | 'onAddColumn' | 'onDeleteColumn' | 'onDeleteTable' | 'onOpenColumnEditor' | 'searchQuery' | 'setSearchQuery'>> = ({
  projects,
  activeProjectId,
  onSwitchProject,
  onNewProject,
  onDeleteProject,
  onRenameProject,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const activeProject = projects.find(p => p.id === activeProjectId);

  useEffect(() => {
    if (activeProject) {
      setRenameValue(activeProject.name);
    }
  }, [activeProject]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRename = () => {
    if (activeProjectId && renameValue.trim()) {
      onRenameProject(activeProjectId, renameValue.trim());
      setIsRenaming(false);
      setIsOpen(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleRename();
      if (e.key === 'Escape') {
          setIsRenaming(false);
          setRenameValue(activeProject?.name ?? '');
      }
  }

  if (!activeProject) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-gray-900 rounded-md hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center min-w-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2-2V5H4z" />
                <path d="M2 9a2 2 0 00-2 2v4a2 2 0 002 2h12a2 2 0 002-2v-4a2 2 0 00-2-2H2z" />
            </svg>
            <span className="font-semibold truncate">{activeProject.name}</span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-full bg-gray-700 rounded-lg shadow-xl z-20 border border-gray-600">
          <div className="p-2 max-h-60 overflow-y-auto">
            {projects.sort((a,b) => b.lastModified - a.lastModified).map(project => (
              <button
                key={project.id}
                onClick={() => { onSwitchProject(project.id); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${project.id === activeProjectId ? 'bg-blue-600 text-white' : 'hover:bg-gray-600'}`}
              >
                {project.name}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-600 p-2 space-y-1">
             {isRenaming ? (
                 <div className="flex items-center">
                     <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={handleKeyDown} className="w-full bg-gray-800 text-sm p-2 rounded-l-md border border-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500" autoFocus onFocus={e => e.target.select()}/>
                     <button onClick={handleRename} className="p-2 bg-blue-600 rounded-r-md hover:bg-blue-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></button>
                 </div>
             ) : (
                <button onClick={() => setIsRenaming(true)} className="w-full text-left flex items-center px-3 py-2 text-sm rounded-md hover:bg-gray-600 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                    Rename
                </button>
             )}
            <button onClick={() => { onNewProject(); setIsOpen(false); }} className="w-full text-left flex items-center px-3 py-2 text-sm rounded-md hover:bg-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                New Project
            </button>
            <button onClick={() => { if(activeProjectId) onDeleteProject(activeProjectId); }} className="w-full text-left flex items-center px-3 py-2 text-sm rounded-md hover:bg-red-800/50 text-red-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                Delete Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const LeftPanel: React.FC<ExplorerPanelProps> = ({ 
  schema, 
  onUpdateTable,
  onAddColumn,
  onDeleteColumn,
  onDeleteTable,
  onOpenColumnEditor,
  searchQuery,
  setSearchQuery,
  ...projectProps
}) => {
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);

  const handleEdit = (element: Table) => {
    setEditing({ id: element.id!, value: element.name });
  };
  
  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (editing) {
      setEditing({ ...editing, value: e.target.value });
    }
  };

  const handleEditCommit = (tableId: string) => {
    if (!editing) return;
    onUpdateTable(tableId, editing.value);
    setEditing(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, tableId: string) => {
    if (e.key === 'Enter') {
      handleEditCommit(tableId);
    } else if (e.key === 'Escape') {
      setEditing(null);
    }
  };

  const tablesToDisplay = useMemo(() => {
    if (!schema) return [];
    if (!searchQuery) return schema.tables;

    const lowercasedQuery = searchQuery.toLowerCase();
    return schema.tables.filter(table =>
        table.name.toLowerCase().includes(lowercasedQuery) ||
        table.columns.some(col => col.name.toLowerCase().includes(lowercasedQuery))
    );
  }, [schema, searchQuery]);


  return (
    <div className="flex flex-col h-full bg-gray-800 text-gray-300">
      <div className="p-4 border-b border-gray-700 space-y-4">
        <div>
            <h2 className="text-xl font-bold text-white">vibedb</h2>
            <p className="text-sm text-gray-400">Visualize, edit, and export schemas.</p>
        </div>
        <ProjectSwitcher {...projectProps} />
      </div>
      
      <div className="p-4 flex-grow overflow-y-auto">
          <h3 className="font-semibold mb-3 text-gray-200 text-lg">Schema Explorer</h3>
          <div className="mb-3 relative">
            <input
                type="search"
                placeholder="Search tables or columns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-900/70 border border-gray-600 rounded-md py-2 pl-8 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          {schema && schema.tables.length > 0 ? (
              <ul className="space-y-3">
                  {tablesToDisplay.map(table => (
                      <li key={table.id}>
                          <details className="group" open>
                             <summary className="font-semibold text-white cursor-pointer list-none flex items-center justify-between gap-2 hover:bg-gray-700/50 p-1 rounded-md group">
                              <div className="flex items-center gap-2 flex-grow min-w-0" onDoubleClick={() => handleEdit(table)}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transform transition-transform details-open:rotate-90 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                                {editing?.id === table.id ? (
                                  <input 
                                    type="text"
                                    value={editing.value}
                                    onChange={handleEditChange}
                                    onBlur={() => handleEditCommit(table.id!)}
                                    onKeyDown={(e) => handleEditKeyDown(e, table.id!)}
                                    className="bg-gray-900 border border-blue-500 px-1 py-0.5 rounded text-sm font-mono w-full"
                                    autoFocus
                                  />
                                ) : (
                                  <span className="bg-gray-900/50 border border-gray-600 px-2 py-0.5 rounded text-sm font-mono truncate">{table.name}</span>
                                )}
                              </div>
                              <div className="flex items-center flex-shrink-0">
                                  <button onClick={() => onAddColumn(table.id!)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white" title="Add column">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                                  </button>
                                  <button onClick={() => onDeleteTable(table.id!)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400 ml-1" title="Delete table">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                                  </button>
                              </div>
                             </summary>
                             <ul className="pl-5 pt-2 space-y-1.5 border-l border-gray-700 ml-2 mt-2">
                                 {table.columns
                                    .filter(col => !searchQuery || col.name.toLowerCase().includes(searchQuery.toLowerCase()) || table.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                    .map(col => (
                                     <li key={col.id} className="group flex items-center justify-between text-sm font-mono text-gray-400 hover:bg-gray-700/50 p-1 rounded-md">
                                         <div className="flex items-start cursor-pointer" onDoubleClick={(e) => onOpenColumnEditor(table, col, { x: e.clientX, y: e.clientY })}>
                                            <div className="w-5 flex-shrink-0 text-center pt-0.5">
                                                {col.isPrimaryKey && <span title="Primary Key" className="text-yellow-400">🔑</span>}
                                                {col.isForeignKey && <span title={`Foreign Key to ${col.foreignKeyTable}.${col.foreignKeyColumn}`} className="text-blue-400">🔗</span>}
                                                {!col.isPrimaryKey && !col.isForeignKey && <span className="text-gray-600">&bull;</span>}
                                            </div>
                                            <div>
                                                <span>{col.name}: </span>
                                                <span className="text-gray-500 ml-1">{col.type}</span>
                                            </div>
                                         </div>
                                         <button onClick={() => onDeleteColumn(table.id!, col.id!)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400" title="Delete column">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                        </button>
                                     </li>
                                 ))}
                             </ul>
                          </details>
                      </li>
                  ))}
              </ul>
          ) : (
              <div className="text-center text-gray-500 mt-8">
                  <p>No schema loaded.</p>
                  <p className="text-sm">{searchQuery ? 'No results found.' : 'Import DDL or add a table to begin.'}</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default LeftPanel;


