import React, { useState, useCallback, useMemo, useEffect } from 'react';
import pako from 'pako';
import { Schema, Message, Dialect, Table, Column, ActiveTool, Project } from '@/types';
import LeftPanel from '@/components/layout/LeftPanel';
import SchemaGraph from '@/components/schema/SchemaGraph';
import RightPanel from '@/components/layout/ControlPanel';
import Toolbox from '@/components/layout/Toolbox';
import ColumnEditor from '@/components/schema/ColumnEditor';
import { parseDdl, modifySchema, generateDdl, createSchemaFromPrompt, generateCustom } from '@/lib/ai/geminiClient';
import { useApiKey } from '@/hooks/useApiKey';

let idCounter = 0;
const initializeSchemaIds = (schema: Schema): Schema => {
  return {
    ...schema,
    tables: schema.tables.map(table => {
      const tableId = `table-${table.name.replace(/\s+/g, '_')}-${idCounter++}`;
      return {
        ...table,
        id: tableId,
        columns: table.columns.map(column => ({
          ...column,
          id: `col-${tableId}-${column.name.replace(/\s+/g, '_')}-${idCounter++}`,
        })),
      };
    }),
  };
};

const reconcileSchemaIds = (newSchema: Schema, oldSchema: Schema): Schema => {
  const oldTablesMap = new Map(oldSchema.tables.map(t => [t.name, t]));

  return {
    ...newSchema,
    tables: newSchema.tables.map(newTable => {
      const oldTable = oldTablesMap.get(newTable.name);
      const tableId = oldTable?.id || `table-${newTable.name.replace(/\s+/g, '_')}-${idCounter++}`;
      
      const oldColumnsMap = new Map(oldTable?.columns.map(c => [c.name, c]) || []);

      return {
        ...newTable,
        id: tableId,
        x: newTable.x ?? oldTable?.x,
        y: newTable.y ?? oldTable?.y,
        columns: newTable.columns.map(newColumn => {
          const oldColumn = oldColumnsMap.get(newColumn.name);
          return {
            ...newColumn,
            id: oldColumn?.id || `col-${tableId}-${newColumn.name.replace(/\s+/g, '_')}-${idCounter++}`,
          };
        }),
      };
    }),
  };
};

const AiToast: React.FC<{ message: string | null }> = ({ message }) => {
    if (!message) return null;
  
    return (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white p-3 rounded-lg z-50 shadow-lg flex items-center gap-2">
        <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>{message}</span>
      </div>
    );
};


const App: React.FC = () => {
  const { apiKey } = useApiKey();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [editingColumn, setEditingColumn] = useState<{ tableId: string; columnId: string; } | null>(null);
  const [editorPosition, setEditorPosition] = useState<{ x: number, y: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [base64Schema, setBase64Schema] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    try {
      const savedProjects = localStorage.getItem('vibedb_projects');
      const savedActiveId = localStorage.getItem('vibedb_activeProjectId');
      
      if (savedProjects) {
        const loadedProjects = JSON.parse(savedProjects);
        setProjects(loadedProjects);
        if (savedActiveId && loadedProjects.some((p: Project) => p.id === savedActiveId)) {
          setActiveProjectId(savedActiveId);
        } else if (loadedProjects.length > 0) {
          setActiveProjectId(loadedProjects[0].id);
        }
      } else {
        const newProject: Project = {
          id: `proj-${Date.now()}`,
          name: 'My First Schema',
          schema: null,
          messages: [],
          ddl: '',
          undoStack: [],
          redoStack: [],
          lastModified: Date.now(),
        };
        setProjects([newProject]);
        setActiveProjectId(newProject.id);
      }
    } catch (e) {
      console.error("Failed to load projects from localStorage", e);
      localStorage.removeItem('vibedb_projects');
      localStorage.removeItem('vibedb_activeProjectId');
    }
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem('vibedb_projects', JSON.stringify(projects));
    }
    if (activeProjectId) {
      localStorage.setItem('vibedb_activeProjectId', activeProjectId);
    }
  }, [projects, activeProjectId]);
  
  const activeProject = useMemo(() => {
    return projects.find(p => p.id === activeProjectId) ?? null;
  }, [projects, activeProjectId]);

  useEffect(() => {
    if (!activeProject?.schema) {
        setHighlightedIds(new Set());
        return;
    }
    if (!searchQuery) {
        setHighlightedIds(new Set());
        return;
    }

    const lowercasedQuery = searchQuery.toLowerCase();
    const newHighlightedIds = new Set<string>();

    activeProject.schema.tables.forEach(table => {
        const tableNameMatch = table.name.toLowerCase().includes(lowercasedQuery);
        let hasMatchingColumn = false;
        
        table.columns.forEach(col => {
            if (col.name.toLowerCase().includes(lowercasedQuery)) {
                newHighlightedIds.add(col.id!);
                hasMatchingColumn = true;
            }
        });
        
        if (tableNameMatch || hasMatchingColumn) {
            newHighlightedIds.add(table.id!);
        }
    });

    setHighlightedIds(newHighlightedIds);
  }, [activeProject?.schema, searchQuery]);
  
  const updateActiveProject = useCallback((updates: Partial<Project>) => {
    setProjects(prevProjects => 
      prevProjects.map(p => 
        p.id === activeProjectId 
          ? { ...p, ...updates, lastModified: Date.now() } 
          : p
      )
    );
  }, [activeProjectId]);

  const commitSchemaChange = useCallback((newSchema: Schema | null) => {
    if (!activeProject) return;
    const newUndoStack = [...activeProject.undoStack, activeProject.schema];
    updateActiveProject({
      schema: newSchema,
      undoStack: newUndoStack,
      redoStack: [],
      ddl: newSchema === null ? '' : activeProject.ddl,
    });
  }, [activeProject, updateActiveProject]);

  const handleUndo = useCallback(() => {
    if (!activeProject || activeProject.undoStack.length === 0) return;
    const newUndoStack = [...activeProject.undoStack];
    const previousSchema = newUndoStack.pop();
    const newRedoStack = [activeProject.schema, ...activeProject.redoStack];
    updateActiveProject({
      schema: previousSchema!,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      ddl: previousSchema === null ? '' : activeProject.ddl,
    });
  }, [activeProject, updateActiveProject]);

  const handleRedo = useCallback(() => {
    if (!activeProject || activeProject.redoStack.length === 0) return;
    const newRedoStack = [...activeProject.redoStack];
    const nextSchema = newRedoStack.shift();
    const newUndoStack = [...activeProject.undoStack, activeProject.schema];
    updateActiveProject({
      schema: nextSchema!,
      undoStack: newUndoStack,
      redoStack: newRedoStack,
      ddl: nextSchema === null ? '' : activeProject.ddl,
    });
  }, [activeProject, updateActiveProject]);
  
  const handleCreateProject = () => {
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: `Untitled Schema ${projects.length + 1}`,
      schema: null,
      messages: [],
      ddl: '',
      undoStack: [],
      redoStack: [],
      lastModified: Date.now(),
    };
    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(newProject.id);
  };

  const handleSwitchProject = (projectId: string) => {
    setActiveProjectId(projectId);
    setSearchQuery('');
  };

  const handleDeleteProject = (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      const remainingProjects = projects.filter(p => p.id !== projectId);
      setProjects(remainingProjects);
      if (activeProjectId === projectId) {
        setActiveProjectId(remainingProjects.length > 0 ? remainingProjects[0].id : null);
      }
    }
  };

  const handleRenameProject = (projectId: string, newName: string) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name: newName } : p));
  };


  useEffect(() => {
    if (activeProject?.schema) {
      try {
        const jsonString = JSON.stringify(activeProject.schema);
        const compressed = pako.deflate(jsonString);
        let binaryString = '';
        for (let i = 0; i < compressed.length; i++) {
          binaryString += String.fromCharCode(compressed[i]);
        }
        const base64String = btoa(binaryString);
        setBase64Schema(base64String);
      } catch (e) {
        console.error("Failed to compress and encode schema to base64", e);
        setBase64Schema('');
      }
    } else {
      setBase64Schema('');
    }
  }, [activeProject]);
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        if (event.key.toLowerCase() === 'z') {
          event.preventDefault();
          if (event.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        } else if (event.key.toLowerCase() === 'y') {
           event.preventDefault();
           handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo, handleRedo]);


  const handleImportDdl = useCallback(async (ddlText: string) => {
    if (!ddlText.trim()) {
      setError('DDL input cannot be empty.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setToastMessage("AI is parsing your DDL...");

    try {
      const parsedSchema = await parseDdl(ddlText, apiKey || undefined);
      const schemaWithIds = initializeSchemaIds(parsedSchema);
      commitSchemaChange(schemaWithIds);
      updateActiveProject({
        messages: [{ sender: 'ai', text: 'Schema parsed successfully! How can I help you modify it?' }],
        ddl: ddlText,
      });
    } catch (err) {
      console.error(err);
      setError('Failed to parse DDL. Please check the syntax and try again.');
      updateActiveProject({ schema: null });
    } finally {
      setIsLoading(false);
      setToastMessage(null);
    }
  }, [commitSchemaChange, updateActiveProject, apiKey]);

  const handleImportBase64 = useCallback((base64String: string) => {
    if (!base64String.trim()) {
        setError('Base64 input cannot be empty.');
        return;
    }
    setError(null);
    try {
        const compressedBinaryStr = atob(base64String);
        const compressedData = new Uint8Array(compressedBinaryStr.length);
        for (let i = 0; i < compressedBinaryStr.length; i++) {
            compressedData[i] = compressedBinaryStr.charCodeAt(i);
        }
        const jsonString = pako.inflate(compressedData, { to: 'string' });
        let parsedSchema = JSON.parse(jsonString) as Schema;
        
        const needsIds = parsedSchema.tables.some(t => !t.id || t.columns.some(c => !c.id));
        if (needsIds) {
            console.warn("Imported base64 schema was missing some IDs. Initializing them now.");
            parsedSchema = initializeSchemaIds(parsedSchema);
        }

        commitSchemaChange(parsedSchema);
        updateActiveProject({ 
            messages: [{ sender: 'ai', text: 'Schema imported from Base64 successfully!' }],
            ddl: '',
        });
    } catch (err) {
        console.error(err);
        setError('Failed to parse compressed Base64. Please ensure the string is valid.');
        updateActiveProject({ schema: null });
    }
  }, [commitSchemaChange, updateActiveProject]);


  const handleSendMessage = useCallback(async (userMessage: string) => {
    if (!activeProject) return;
    const newMessages: Message[] = [...activeProject.messages, { sender: 'user', text: userMessage }];
    updateActiveProject({ messages: newMessages });
    setIsLoading(true);
    setError(null);
    setToastMessage(activeProject.schema ? "AI is updating the schema..." : "AI is creating a new schema...");

    try {
      if (activeProject.schema) {
        const updatedSchemaFromAI = await modifySchema(userMessage, activeProject.schema, apiKey || undefined);
        const reconciledSchema = reconcileSchemaIds(updatedSchemaFromAI, activeProject.schema);
        commitSchemaChange(reconciledSchema);
        updateActiveProject({ messages: [...newMessages, { sender: 'ai', text: 'Schema updated based on your request. What\'s next?' }]});
      } else {
        const newSchemaFromAI = await createSchemaFromPrompt(userMessage, apiKey || undefined);
        const schemaWithIds = initializeSchemaIds(newSchemaFromAI);
        commitSchemaChange(schemaWithIds);
        updateActiveProject({ messages: [...newMessages, { sender: 'ai', text: "I've created a schema for you! How would you like to refine it?" }]});
      }
    } catch (err) {
      console.error(err);
      const errorMessage = 'Sorry, I couldn\'t apply that change. Please try rephrasing your request.';
      setError(errorMessage);
      updateActiveProject({ messages: [...newMessages, { sender: 'ai', text: errorMessage }]});
    } finally {
      setIsLoading(false);
      setToastMessage(null);
    }
  }, [activeProject, commitSchemaChange, updateActiveProject, apiKey]);
  
  const handleExportDdl = useCallback(async (dialect: Dialect) => {
    if (!activeProject?.schema) {
      setError('No schema to export.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setToastMessage("AI is generating DDL...");
    try {
        const exportedDdl = await generateDdl(activeProject.schema, dialect, apiKey || undefined);
        updateActiveProject({ ddl: exportedDdl });
    } catch (err) {
        console.error(err);
        setError('Failed to generate DDL for export.');
    } finally {
        setIsLoading(false);
        setToastMessage(null);
    }
  }, [activeProject, updateActiveProject, apiKey]);
  
  const handleExportOther = useCallback(async (target: string) => {
    if (!activeProject?.schema) {
      setError('No schema to export.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setToastMessage("AI is generating export...");
    try {
      const output = await generateCustom(activeProject.schema, target, apiKey || undefined);
      updateActiveProject({ ddl: output });
    } catch (err) {
      console.error(err);
      setError('Failed to generate requested export.');
    } finally {
      setIsLoading(false);
      setToastMessage(null);
    }
  }, [activeProject, updateActiveProject, apiKey]);
  
  const handleAddTable = useCallback(async (position?: { x: number, y: number }) => {
    if (!activeProject) return;
    const currentSchema = activeProject.schema ?? { tables: [] };
    let newTableName = 'new_table';
    let counter = 1;
    while (currentSchema.tables.some(t => t.name === (counter > 1 ? `${newTableName}_${counter}`: newTableName))) {
        counter++;
    }
    newTableName = counter > 1 ? `${newTableName}_${counter}`: newTableName;
    
    const tableId = `table-${newTableName}-${Date.now()}`;
    const newTable: Table = {
        id: tableId,
        name: newTableName,
        columns: [
          { id: `${tableId}-col-id`, name: 'id', type: 'INTEGER', isPrimaryKey: true, isForeignKey: false, constraints: ['NOT NULL'] },
        ],
        ...position,
    };

    const updatedSchema = {
        ...currentSchema,
        tables: [...currentSchema.tables, newTable],
    };
    
    if (activeProject.messages.length === 0) {
        updateActiveProject({ messages: [{ sender: 'ai', text: `Started a new schema and added table "${newTableName}".` }]});
    }
    
    commitSchemaChange(updatedSchema);
  }, [activeProject, updateActiveProject, commitSchemaChange]);

  const handleAddConnection = useCallback(async (sourceTableId: string, targetTableId: string, type: '1-to-n' | 'n-to-n') => {
    if (!activeProject?.schema) return;

    const currentSchema = JSON.parse(JSON.stringify(activeProject.schema));
    const sourceTable = currentSchema.tables.find((t: Table) => t.id === sourceTableId);
    const targetTable = currentSchema.tables.find((t: Table) => t.id === targetTableId);

    if (!sourceTable || !targetTable) {
        setError('Source or target table not found for connection.');
        return;
    }

    if (type === '1-to-n') {
        const targetPk = targetTable.columns.find((c: Column) => c.isPrimaryKey);
        if (!targetPk) {
            setError(`Cannot create connection: Target table "${targetTable.name}" has no primary key.`);
            return;
        }

        let fkColumnName = `${targetTable.name}_id`;
        let counter = 1;
        while(sourceTable.columns.some((c: Column) => c.name === fkColumnName)) {
            counter++;
            fkColumnName = `${targetTable.name}_id_${counter}`;
        }

        const newFkColumn: Column = {
            id: `col-${sourceTable.id}-${fkColumnName}-${Date.now()}`,
            name: fkColumnName,
            type: targetPk.type,
            isPrimaryKey: false,
            isForeignKey: true,
            foreignKeyTable: targetTable.name,
            foreignKeyColumn: targetPk.name,
            constraints: [],
        };
        sourceTable.columns.push(newFkColumn);
        commitSchemaChange(currentSchema);

    } else if (type === 'n-to-n') {
        const sourcePk = sourceTable.columns.find((c: Column) => c.isPrimaryKey);
        const targetPk = targetTable.columns.find((c: Column) => c.isPrimaryKey);

        if (!sourcePk || !targetPk) {
            setError(`Cannot create N-N connection: Both tables must have a primary key.`);
            return;
        }

        let junctionTableName = `${sourceTable.name}_${targetTable.name}`;
        let counter = 1;
        while (currentSchema.tables.some((t: Table) => t.name === junctionTableName)) {
            counter++;
            junctionTableName = `${sourceTable.name}_${targetTable.name}_${counter}`;
        }
        
        const junctionTableId = `table-${junctionTableName}-${Date.now()}`;
        
        const fkCol1: Column = {
            id: `col-${junctionTableId}-${sourceTable.name}_id-${Date.now()}`,
            name: `${sourceTable.name}_id`,
            type: sourcePk.type,
            isPrimaryKey: true,
            isForeignKey: true,
            foreignKeyTable: sourceTable.name,
            foreignKeyColumn: sourcePk.name,
            constraints: ['NOT NULL'],
        };

        const fkCol2: Column = {
            id: `col-${junctionTableId}-${targetTable.name}_id-${Date.now()}`,
            name: `${targetTable.name}_id`,
            type: targetPk.type,
            isPrimaryKey: true,
            isForeignKey: true,
            foreignKeyTable: targetTable.name,
            foreignKeyColumn: targetPk.name,
            constraints: ['NOT NULL'],
        };
        
        const junctionTable: Table = {
            id: junctionTableId,
            name: junctionTableName,
            columns: [fkCol1, fkCol2],
            x: (sourceTable.x + targetTable.x) / 2,
            y: (sourceTable.y + targetTable.y) / 2,
        };
        
        currentSchema.tables.push(junctionTable);
        commitSchemaChange(currentSchema);
    }
  }, [activeProject, commitSchemaChange]);

  const handleUpdateTable = useCallback((tableId: string, newName: string) => {
    if (!activeProject?.schema) return;
    if (activeProject.schema.tables.some(t => t.name === newName && t.id !== tableId)) {
        setError(`A table with the name "${newName}" already exists.`);
        return;
    }
    
    const oldName = activeProject.schema.tables.find(t => t.id === tableId)?.name;
    if (!oldName) return;

    const updatedSchema = JSON.parse(JSON.stringify(activeProject.schema));
    
    const tableToUpdate = updatedSchema.tables.find((t: Table) => t.id === tableId);
    if (tableToUpdate) {
        tableToUpdate.name = newName;
    }

    updatedSchema.tables.forEach((table: Table) => {
        table.columns.forEach((column: Column) => {
            if (column.isForeignKey && column.foreignKeyTable === oldName) {
                column.foreignKeyTable = newName;
            }
        });
    });

    commitSchemaChange(updatedSchema);
  }, [activeProject, commitSchemaChange]);

  const handleUpdateTablePosition = useCallback((tableId: string, position: { x: number; y: number }) => {
    if (!activeProject?.schema) return;
    const newSchema = {
      ...activeProject.schema,
      tables: activeProject.schema.tables.map(table => 
        table.id === tableId ? { ...table, x: position.x, y: position.y } : table
      )
    };
    updateActiveProject({ schema: newSchema });
  }, [activeProject, updateActiveProject]);


  const handleAddColumn = useCallback((tableId: string) => {
      if (!activeProject?.schema) return;
      const updatedSchema = JSON.parse(JSON.stringify(activeProject.schema));
      const tableToUpdate = updatedSchema.tables.find((t: Table) => t.id === tableId);
      if (!tableToUpdate) return;
      
      let newColName = 'new_column';
      let counter = 1;
      while (tableToUpdate.columns.some((c: Column) => c.name === (counter > 1 ? `${newColName}_${counter}` : newColName))) {
          counter++;
      }
      newColName = counter > 1 ? `${newColName}_${counter}` : newColName;
      
      tableToUpdate.columns.push({
          id: `col-${tableToUpdate.id}-${newColName}-${Date.now()}`,
          name: newColName,
          type: 'VARCHAR(255)',
          isPrimaryKey: false,
          isForeignKey: false,
          constraints: [],
      });
      
      commitSchemaChange(updatedSchema);
  }, [activeProject, commitSchemaChange]);

  const handleOpenColumnEditor = useCallback((table: Table, column: Column, position: { x: number, y: number }) => {
    setEditingColumn({ tableId: table.id!, columnId: column.id! });
    setEditorPosition(position);
  }, []);

  const handleCloseColumnEditor = useCallback(() => {
    setEditingColumn(null);
    setEditorPosition(null);
  }, []);

  const handleUpdateColumnDetails = useCallback((tableId: string, columnId: string, updatedColumn: Column) => {
    if (!activeProject?.schema) return;

    const updatedSchema = JSON.parse(JSON.stringify(activeProject.schema));
    const tableToUpdate = updatedSchema.tables.find((t: Table) => t.id === tableId);
    if (!tableToUpdate) return;
    
    if (tableToUpdate.columns.some((c: Column) => c.name === updatedColumn.name && c.id !== columnId)) {
        setError(`A column named "${updatedColumn.name}" already exists in table "${tableToUpdate.name}".`);
        return;
    }

    const columnIndex = tableToUpdate.columns.findIndex((c: Column) => c.id === columnId);
    if (columnIndex === -1) return;
    
    const oldColumn = tableToUpdate.columns[columnIndex];
    
    tableToUpdate.columns[columnIndex] = updatedColumn;

    if (oldColumn.isPrimaryKey && oldColumn.name !== updatedColumn.name) {
        updatedSchema.tables.forEach((table: Table) => {
            table.columns.forEach((column: Column) => {
                if (column.isForeignKey && column.foreignKeyTable === tableToUpdate.name && column.foreignKeyColumn === oldColumn.name) {
                    column.foreignKeyColumn = updatedColumn.name;
                }
            });
        });
    }
    
    commitSchemaChange(updatedSchema);
  }, [activeProject, commitSchemaChange]);

  const handleDeleteColumn = useCallback((tableId: string, columnId: string) => {
      if (!activeProject?.schema) return;
      const schema = activeProject.schema;
      const tableToDeleteFrom = schema.tables.find(t => t.id === tableId);
      const columnToDelete = tableToDeleteFrom?.columns.find(c => c.id === columnId);
      if (!tableToDeleteFrom || !columnToDelete) return;

      for (const table of schema.tables) {
          for (const column of table.columns) {
              if (column.isForeignKey && column.foreignKeyTable === tableToDeleteFrom.name && column.foreignKeyColumn === columnToDelete.name) {
                  setError(`Cannot delete column "${columnToDelete.name}". It is referenced by "${table.name}.${column.name}".`);
                  return;
              }
          }
      }

      const updatedTables = schema.tables.map(t => {
          if (t.id === tableId) {
              return { ...t, columns: t.columns.filter(c => c.id !== columnId) };
          }
          return t;
      });
      
      commitSchemaChange({ ...schema, tables: updatedTables });
  }, [activeProject, commitSchemaChange]);

  const handleDeleteTable = useCallback((tableId: string) => {
    if (!activeProject?.schema) return;
    const schema = activeProject.schema;

    const tableToDelete = schema.tables.find(t => t.id === tableId);
    if (!tableToDelete) return;

    if (!window.confirm(`Are you sure you want to delete the table "${tableToDelete.name}"? This action also removes any foreign keys referencing it.`)) {
      return;
    }

    const remainingTables = schema.tables.filter(t => t.id !== tableId);
    
    const cleanedTables = remainingTables.map(table => {
      const cleanedColumns = table.columns.filter(column => 
        !(column.isForeignKey && column.foreignKeyTable === tableToDelete.name)
      );
      return { ...table, columns: cleanedColumns };
    });

    commitSchemaChange({ ...schema, tables: cleanedTables });
  }, [activeProject, commitSchemaChange]);

  const editingColumnData = useMemo(() => {
    if (!editingColumn || !activeProject?.schema) return null;
    const table = activeProject.schema.tables.find(t => t.id === editingColumn.tableId);
    if (!table) return null;
    const column = table.columns.find(c => c.id === editingColumn.columnId);
    if (!column) return null;
    return { table, column };
  }, [editingColumn, activeProject]);

  if (!activeProject) {
    return (
      <div className="flex h-screen w-screen bg-gray-900 text-gray-200 items-center justify-center">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-gray-900 text-gray-200 overflow-hidden">
      <AiToast message={toastMessage} />
      <div className="w-1/4 min-w-[350px] max-w-[450px] flex flex-col border-r border-gray-700">
        <LeftPanel 
            projects={projects}
            activeProjectId={activeProjectId}
            onSwitchProject={handleSwitchProject}
            onNewProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
            onRenameProject={handleRenameProject}
            schema={activeProject.schema}
            onUpdateTable={handleUpdateTable}
            onAddColumn={handleAddColumn}
            onDeleteColumn={handleDeleteColumn}
            onDeleteTable={handleDeleteTable}
            onOpenColumnEditor={handleOpenColumnEditor}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
        />
      </div>

      <div className="flex-1 flex flex-col relative">
        <Toolbox activeTool={activeTool} setActiveTool={setActiveTool} disabled={isLoading} />
        <div className="flex-grow relative bg-gray-800/50">
           {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-800/90 text-white p-3 rounded-lg z-20 shadow-lg border border-red-600 w-full max-w-md">
              <div className="flex items-center">
                  <p className="font-semibold mr-2">Error</p>
                  <p className="text-sm">{error}</p>
                  <button onClick={() => setError(null)} className="ml-auto text-xl font-bold">&times;</button>
              </div>
            </div>
          )}
          {isLoading && !activeProject.schema && !toastMessage && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-blue-500 mx-auto"></div>
                    <p className="mt-4 text-lg font-semibold">Parsing Schema...</p>
                    <p className="text-gray-400">The AI is analyzing your DDL.</p>
                </div>
            </div>
          )}
          {editingColumnData && editorPosition && (
             <ColumnEditor 
               table={editingColumnData.table}
               column={editingColumnData.column}
               position={editorPosition}
               onSave={handleUpdateColumnDetails}
               onClose={handleCloseColumnEditor}
             />
           )}
          <SchemaGraph 
            schema={activeProject.schema}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            onAddTable={handleAddTable}
            onAddConnection={handleAddConnection}
            onUpdateTable={handleUpdateTable}
            onUpdateTablePosition={handleUpdateTablePosition}
            onUpdateColumnDetails={handleUpdateColumnDetails}
            onOpenColumnEditor={handleOpenColumnEditor}
            onAddColumn={handleAddColumn}
            onDeleteColumn={handleDeleteColumn}
            onDeleteTable={handleDeleteTable}
            searchQuery={searchQuery}
            highlightedIds={highlightedIds}
          />
        </div>
      </div>
      
      <div className="w-1/4 min-w-[350px] max-w-[450px] flex flex-col border-l border-gray-700">
        <RightPanel 
          schema={activeProject.schema}
          onImport={handleImportDdl}
          onExport={handleExportDdl}
          onExportOther={handleExportOther}
          ddl={activeProject.ddl}
          setDdl={(newDdl) => updateActiveProject({ ddl: newDdl })}
          isLoading={isLoading}
          messages={activeProject.messages}
          onSendMessage={handleSendMessage}
          base64Schema={base64Schema}
          onImportBase64={handleImportBase64}
        />
      </div>
    </div>
  );
};

export default App;


