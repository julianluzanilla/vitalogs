// Aplica el tema antes de pintar para evitar parpadeo.
(function () {
  try {
    var t = localStorage.getItem('vitalogs.theme');
    var dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
