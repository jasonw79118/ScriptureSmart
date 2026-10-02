declare global {
  interface Window {
    fums?: (...args: unknown[]) => void;
  }
}

export async function reportApiBibleViews(
  tokens: (string | undefined)[],
  userId?: string,
) {
  const viewTokens = [
    ...new Set(
      tokens.filter(
        (token): token is string => !!token && token.length <= 2048,
      ),
    ),
  ];
  if (!viewTokens.length || !window.fums) return;
  // The official FUMS tracker hashes userId before reporting it.
  if (userId) window.fums('config', { userId });
  window.fums('trackView', viewTokens);
}
