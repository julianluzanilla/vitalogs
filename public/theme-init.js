// Aplica el tema antes de pintar para evitar parpadeo.
(function () {
  try {
    var t = localStorage.getItem('vitalogs.theme');
    var dark = t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) {
      document.documentElement.classList.add('dark');
      document.querySelector('meta[name="theme-color"]').setAttribute('content', '#061820');
    }
  } catch (e) {}
})();
