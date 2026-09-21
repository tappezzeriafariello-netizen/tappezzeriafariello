(function () {
  const routeSections = {
    '/': 'home',
    '/catalogo': 'catalogo',
    '/collezione': 'catalogo',
    '/storia': 'storia',
    '/contatti': 'contatti'
  };

  function normalizeHashRoute() {
    const fragment = location.hash ? location.hash.slice(1).toLowerCase() : '';
    const mappedPath = {
      contatti: '/contatti',
      storia: '/storia',
      catalogo: '/catalogo',
      collezione: '/collezione'
    }[fragment];
    if (mappedPath && location.pathname === '/') {
      history.replaceState(null, '', mappedPath);
    }
  }

  function scrollToRouteSection(pathname) {
    const sectionId = routeSections[pathname] || routeSections['/'];
    const target = document.getElementById(sectionId);
    if (!target) return;
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
  }

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
      if (addHistory) history.pushState({ url, scrollY: 0 }, '', url);
      document.head.querySelectorAll('style:not(:last-of-type)').forEach(style => style.remove());
      next.head.querySelectorAll('style').forEach(style => document.head.insertBefore(style.cloneNode(true), transitionStyle));
      document.body.innerHTML = next.body.innerHTML;
      await executePageScripts(document.body);
      const destination = new URL(url, location.href);
      const savedScroll = sessionStorage.getItem(`fariello-scroll:${destination.pathname}${destination.hash}`);
      const destinationSection = routeSections[destination.pathname];
      if (destination.hash) {
        requestAnimationFrame(() => document.querySelector(destination.hash)?.scrollIntoView({ behavior: 'instant', block: 'start' }));
      } else if (destinationSection) {
        requestAnimationFrame(() => document.getElementById(destinationSection)?.scrollIntoView({ behavior: 'instant', block: 'start' }));
      } else {
        window.scrollTo(0, savedScroll ? Number(savedScroll) : (history.state && Number.isFinite(history.state.scrollY) ? history.state.scrollY : 0));
      }
    };
    if (document.startViewTransition) await document.startViewTransition(update).finished;
    else await update();
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || link.target === '_blank' || link.origin !== location.origin) return;
    const url = new URL(link.href);
    if (url.pathname === '/product.html') return;
    if (link.classList.contains('back')) {
      event.preventDefault();
      const isLegalPage = ['/privacy.html', '/cookie.html'].includes(location.pathname);
      const destination = isLegalPage ? '/' : (sessionStorage.getItem('fariello-return-url') || '/');
      navigate(destination).catch(() => { location.href = destination; });
      return;
    }
    const mappedRoute = {
      '#contatti': '/contatti',
      '#storia': '/storia',
      '#catalogo': '/catalogo',
      '#collezione': '/collezione'
    }[url.hash] || null;
    if (mappedRoute) {
      event.preventDefault();
      history.pushState({ url: mappedRoute, scrollY: window.scrollY }, '', mappedRoute);
      scrollToRouteSection(mappedRoute);
      const topbar = document.querySelector('.topbar');
      const menu = document.querySelector('.menu');
      if (topbar) topbar.classList.remove('menu-open');
      if (menu) { menu.setAttribute('aria-expanded', 'false'); menu.textContent = 'Menu'; }
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

  normalizeHashRoute();
  scrollToRouteSection(location.pathname);
  window.addEventListener('popstate', () => {
    normalizeHashRoute();
    scrollToRouteSection(location.pathname);
    navigate(location.href, false).catch(() => location.reload());
  });
})();
