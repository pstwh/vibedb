import React, { useMemo, useState } from 'react';
import { useApiKey } from '@/hooks/useApiKey';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onTestKey?: (apiKey: string) => Promise<boolean>;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose, onTestKey }) => {
  const { apiKey, setApiKey, clearApiKey } = useApiKey();
  const [value, setValue] = useState(apiKey ?? '');
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | 'ok' | 'fail'>(null);

  const masked = useMemo(() => {
    if (!apiKey) return '';
    const last4 = apiKey.slice(-4);
    return `••••••••••••••••${last4}`;
  }, [apiKey]);

  if (!open) return null;

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed) setApiKey(trimmed);
    onClose();
  };

  const handleClear = () => {
    clearApiKey();
    setValue('');
    onClose();
  };

  const handleTest = async () => {
    if (!onTestKey) return;
    const k = value.trim() || apiKey || '';
    if (!k) return;
    setTesting(true);
    setTestResult(null);
    try {
      const ok = await onTestKey(k);
      setTestResult(ok ? 'ok' : 'fail');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-lg shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm mb-1">Gemini API Key</label>
            <div className="flex gap-2">
              <input
                type={show ? 'text' : 'password'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={apiKey ? masked : 'Enter your API key'}
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => setShow(s => !s)}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                {show ? 'Hide' : 'Show'}
              </button>
            </div>
            {apiKey && <p className="text-xs text-gray-400 mt-1">Saved: {masked}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500"
            >
              Save
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600"
            >
              Clear
            </button>
            <button
              onClick={handleTest}
              disabled={!onTestKey || testing || !(value.trim() || apiKey)}
              className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-50"
            >
              {testing ? 'Testing…' : 'Test Key'}
            </button>
            {testResult === 'ok' && <span className="text-green-400 text-sm">OK</span>}
            {testResult === 'fail' && <span className="text-red-400 text-sm">Failed</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;


