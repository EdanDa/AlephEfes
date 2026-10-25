(() => {
  let stored = null;
  try {
    const current = localStorage.getItem('alephThemeMode');
    stored = current === 'light' || current === 'dark' ? current : localStorage.getItem('alephTheme');
  } catch (_err) {
    stored = null;
  }

  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = stored === 'light' || stored === 'dark' ? stored === 'dark' : prefersDark;

  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#111827' : '#f5f6f4');

  const applyBodyTheme = () => {
    if (document.body) document.body.classList.toggle('dark', isDark);
  };

  if (document.body) {
    applyBodyTheme();
  } else {
    document.addEventListener('DOMContentLoaded', applyBodyTheme, { once: true });
  }
})();
