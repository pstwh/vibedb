import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Dialect, Schema, Message } from '@/types';
import ChatPanel from '@/components/chat/ChatPanel';
import SettingsModal from '@/components/settings/SettingsModal';
import { testApiKey } from '@/lib/ai/geminiClient';

interface RightPanelProps {
  schema: Schema | null;
  onImport: (ddl: string) => void;
  onExport: (dialect: Dialect) => void;
  onExportOther: (target: string) => void;
  ddl: string;
  setDdl: (ddl: string) => void;
  isLoading: boolean;
  messages: Message[];
  onSendMessage: (message: string) => void;
  base64Schema: string;
  onImportBase64: (base64String: string) => void;
}

const RightPanel: React.FC<RightPanelProps> = ({
  schema,
  onImport,
  onExport,
  onExportOther,
  ddl,
  setDdl,
  isLoading,
  messages,
  onSendMessage,
  base64Schema,
  onImportBase64,
}) => {
  const [activeTab, setActiveTab] = useState<'ddl' | 'chat' | 'base64'>('ddl');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDialect, setSelectedDialect] = useState<'PostgreSQL' | 'MySQL' | 'SQLite' | 'Other'>('PostgreSQL');
  const [customTarget, setCustomTarget] = useState('');
  const [base64Input, setBase64Input] = useState('');
  const [copyStatus, setCopyStatus] = useState('Copy');
  const [showSettings, setShowSettings] = useState(false);


  useEffect(() => {
    setBase64Input(base64Schema);
    setCopyStatus('Copy');
  }, [base64Schema]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setDdl(text);
        onImport(text);
      };
      reader.readAsText(file);
      event.target.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportClick = useCallback(() => {
    onImport(ddl);
  }, [ddl, onImport]);

  const handleExportClick = useCallback(() => {
    if (selectedDialect === 'Other') {
      if (!customTarget.trim()) return;
      onExportOther(customTarget.trim());
    } else {
      onExport(selectedDialect);
    }
  }, [selectedDialect, onExport, onExportOther, customTarget]);
  
  const handleCopyBase64 = useCallback(() => {
    if (!base64Input) return;
    navigator.clipboard.writeText(base64Input).then(() => {
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus('Copy'), 2000);
    }, () => {
      setCopyStatus('Failed!');
      setTimeout(() => setCopyStatus('Copy'), 2000);
    });
  }, [base64Input]);

  const handleImportBase64Click = useCallback(() => {
    onImportBase64(base64Input);
  }, [base64Input, onImportBase64]);


  const renderDdlView = () => (
    <div className="flex flex-col flex-grow min-h-0 bg-gray-800 text-gray-300 h-full">
      <div className="p-4 flex-grow flex flex-col min-h-0">
        <label htmlFor="ddl-input" className="font-semibold mb-2 text-gray-300">
          Schema DDL
        </label>
        <textarea
          id="ddl-input"
          className="font-mono text-sm w-full flex-grow p-3 bg-gray-900 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          value={ddl}
          onChange={(e) => setDdl(e.target.value)}
          placeholder="Paste your SQL DDL here or upload a file..."
          disabled={isLoading}
        ></textarea>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".sql,.ddl"
            disabled={isLoading}
          />
          <button
            onClick={handleUploadClick}
            disabled={isLoading}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            Upload
          </button>
          <button
            onClick={handleImportClick}
            disabled={isLoading || !ddl}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading && !schema ? (
                <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-white"></div>
            ) : (
                <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                Parse DDL
                </>
            )}
          </button>
        </div>
      </div>

      <div className="p-4 border-t border-gray-700">
        <label htmlFor="dialect-select" className="font-semibold mb-2 block">Export Options</label>
        <select
          id="dialect-select"
          value={selectedDialect}
          onChange={(e) => setSelectedDialect(e.target.value as any)}
          className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        >
          <option>PostgreSQL</option>
          <option>MySQL</option>
          <option>SQLite</option>
          <option>Other</option>
        </select>
        {selectedDialect === 'Other' && (
          <input
            type="text"
            placeholder='Describe your target, e.g. "Python sqlmodel schemas"'
            value={customTarget}
            onChange={(e) => setCustomTarget(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        )}
        <button 
          onClick={handleExportClick}
          disabled={isLoading || !schema || (selectedDialect === 'Other' && !customTarget.trim())}
          className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-2 px-4 rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          Update DDL
        </button>
      </div>
    </div>
  );
  
  const renderBase64View = () => (
    <div className="flex flex-col flex-grow min-h-0 bg-gray-800 text-gray-300 h-full">
        <div className="p-4 flex-grow flex flex-col min-h-0">
            <label htmlFor="base64-input" className="font-semibold mb-2 text-gray-300">
                Shareable Schema (Compressed Base64)
            </label>
            <textarea
                id="base64-input"
                className="font-mono text-xs w-full flex-grow p-3 bg-gray-900 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={base64Input}
                onChange={(e) => setBase64Input(e.target.value)}
                placeholder="Paste a compressed Base64 schema here to import it..."
                disabled={isLoading}
            ></textarea>
            <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                    onClick={handleCopyBase64}
                    disabled={isLoading || !base64Input}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" /><path d="M4 3a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H4z" /></svg>
                    {copyStatus}
                </button>
                <button
                    onClick={handleImportBase64Click}
                    disabled={isLoading || !base64Input}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-2 px-4 rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5L9 4H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
                    Import
                </button>
            </div>
        </div>
    </div>
);


  return (
    <div className="flex flex-col h-full bg-gray-800 text-gray-300">
      <div className="border-b border-gray-700">
        <div className="flex items-center">
        <nav className="flex flex-1" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('ddl')}
            className={`flex-1 py-3 px-1 text-center font-medium text-sm transition-colors duration-200 ${
              activeTab === 'ddl'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
            }`}
          >
            DDL
          </button>
           <button
            onClick={() => setActiveTab('base64')}
            className={`flex-1 py-3 px-1 text-center font-medium text-sm transition-colors duration-200 ${
              activeTab === 'base64'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
            }`}
          >
            Base64
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-3 px-1 text-center font-medium text-sm transition-colors duration-200 ${
              activeTab === 'chat'
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
            }`}
          >
            AI Assistant
          </button>
        </nav>
        <button
          onClick={() => setShowSettings(true)}
          title="Settings"
          className="p-2 text-gray-400 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 -960 960 960" fill="currentColor"><path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z"/></svg>
        </button>
        </div>
      </div>
      
      <div className="flex flex-col flex-grow min-h-0">
        <div className={activeTab === 'ddl' ? 'block h-full' : 'hidden'}>
          {renderDdlView()}
        </div>
        <div className={activeTab === 'base64' ? 'block h-full' : 'hidden'}>
          {renderBase64View()}
        </div>
        <div className={activeTab === 'chat' ? 'block h-full' : 'hidden'}>
          <ChatPanel messages={messages} onSendMessage={onSendMessage} isLoading={isLoading} onOpenSettings={() => setShowSettings(true)} />
        </div>
      </div>
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} onTestKey={testApiKey} />
    </div>
  );
};

export default RightPanel;


