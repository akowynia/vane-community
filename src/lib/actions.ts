export const getSuggestions = async (chatHistory: [string, string][]) => {
  const chatModel = localStorage.getItem('chatModelKey');
  const chatModelProvider = localStorage.getItem('chatModelProviderId');

  const res = await fetch(`/api/suggestions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chatHistory,
      chatModel: {
        providerId: chatModelProvider,
        key: chatModel,
      },
    }),
  });

  const data = (await res.json()) as { suggestions: string[] };

  return data.suggestions;
};

export const getApproxLocation = async () => {
  try {
    const res = await fetch('https://free.freeipapi.com/api/json', {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      throw new Error(`freeipapi returned status ${res.status}`);
    }

    const data = await res.json();

    return {
      latitude: data.latitude ?? 0,
      longitude: data.longitude ?? 0,
      city: data.cityName || 'Unknown',
    };
  } catch (err) {
    console.warn('Failed to retrieve approx location, using fallback:', err);
    return {
      latitude: 0,
      longitude: 0,
      city: 'Unknown',
    };
  }
};
