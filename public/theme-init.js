(() => {
  let stored = null;
  try {
    stored = localStorage.getItem('alephTheme');
  } catch (_err) {
    stored = null;
  }

  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = stored ? stored === 'dark' : prefersDark;

  document.documentElement.classList.toggle('dark', isDark);

  const applyBodyTheme = () => {
    if (document.body) document.body.classList.toggle('dark', isDark);
  };

  if (document.body) {
    applyBodyTheme();
  } else {
    document.addEventListener('DOMContentLoaded', applyBodyTheme, { once: true });
  }
})();
