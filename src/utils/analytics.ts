export const trackEngagement = async (action: string, page: string, userId: string | null = null) => {
  try {
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, page, userId }),
    });
  } catch (err) {
    console.warn('Analytics tracking error:', err);
  }
};
