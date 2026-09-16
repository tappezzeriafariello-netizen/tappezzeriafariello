(function () {
  const transitionStyle = document.createElement('style');
  transitionStyle.textContent = '::view-transition-old(root){animation:page-out .35s ease both}::view-transition-new(root){animation:page-in .55s cubic-bezier(.2,.7,.2,1) both}@keyframes page-out{to{opacity:0;transform:translateY(-14px)}}@keyframes page-in{from{opacity:0;transform:translateY(18px)}}';
  document.head.appendChild(transitionStyle);

  async function executePageScripts(body) {
    const scripts = [...body.querySelectorAll('script')];
    for (const script of scripts) {
      if (script.src || script.dataset.navigation) continue;
      const replacement = document.createElement('script');
      replacement.textContent = `(function () {\n${script.textContent}\n})();`;
      script.replaceWith(replacement);
    }
  }

  async function navigate(url, addHistory = true) {
    const response = await fetch(url, { headers: { 'X-Requested-Page': 'true' } });
    if (!response.ok) throw new Error('Pagina non disponibile');
    const next = new DOMParser().parseFromString(await response.text(), 'text/html');
    const update = async () => {
      document.title = next.title;
      document.head.querySelectorAll('style:not(:last-of-type)').forEach(style => style.remove());
      next.head.querySelectorAll('style').forEach(style => document.head.insertBefore(style.cloneNode(true), transitionStyle));
      document.body.innerHTML = next.body.innerHTML;
      await executePageScripts(document.body);
      if (addHistory) history.pushState({ url, scrollY: 0 }, '', url);
      const destination = new URL(url, location.href);
      const savedScroll = sessionStorage.getItem(`fariello-scroll:${destination.pathname}${destination.hash}`);
      window.scrollTo(0, savedScroll ? Number(savedScroll) : (history.state && Number.isFinite(history.state.scrollY) ? history.state.scrollY : 0));
      if (destination.hash) requestAnimationFrame(() => document.querySelector(destination.hash)?.scrollIntoView({ behavior: 'instant', block: 'start' }));
    };
    if (document.startViewTransition) await document.startViewTransition(update).finished;
    else await update();
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || link.target === '_blank' || link.origin !== location.origin) return;
    const url = new URL(link.href);
    if (link.classList.contains('back')) {
      event.preventDefault();
      navigate(sessionStorage.getItem('fariello-return-url') || '/').catch(() => { location.href = link.href; });
      return;
    }
    if (url.hash && url.pathname === location.pathname) {
      event.preventDefault();
      const target = document.querySelector(url.hash);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState({ url: `${url.pathname}${url.hash}`, scrollY: window.scrollY }, '', `${url.pathname}${url.hash}`);
      const topbar = document.querySelector('.topbar');
      const menu = document.querySelector('.menu');
      if (topbar) topbar.classList.remove('menu-open');
      if (menu) { menu.setAttribute('aria-expanded', 'false'); menu.textContent = 'Menu'; }
      return;
    }
    sessionStorage.setItem(`fariello-scroll:${location.pathname}${location.hash}`, String(window.scrollY));
    sessionStorage.setItem('fariello-return-url', `${location.pathname}${location.search}${location.hash}`);
    history.replaceState({ ...(history.state || {}), scrollY: window.scrollY }, '', location.href);
    event.preventDefault();
    navigate(`${url.pathname}${url.search}${url.hash}`).catch(() => { location.href = link.href; });
  });

  window.addEventListener('popstate', () => navigate(location.href, false).catch(() => location.reload()));
})();
