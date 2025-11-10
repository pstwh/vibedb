import { useApiKeyContext } from '@/providers/ApiKeyProvider';

export function useApiKey() {
  const { apiKey, setApiKey, clearApiKey } = useApiKeyContext();
  return { apiKey, setApiKey, clearApiKey };
}


