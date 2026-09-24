(function () {
  const routeSections = {
    '/': 'home',
    '/catalogo': 'catalogo',
    '/collezione': 'catalogo',
    '/storia': 'storia',
    '/contatti': 'contatti'
  };
  const legalPages = ['/privacy.html', '/cookie.html'];
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  function shouldResetScroll(pathname) {
    return legalPages.includes(pathname) || !routeSections[pathname];
  }

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
  transitionStyle.textContent = 'html:has(.cursor),html:has(.cursor) *{cursor:none !important}.cursor,.cursor-ring{position:fixed;pointer-events:none;z-index:20;border-radius:50%;transform:translate(-50%,-50%)}.cursor{width:6px;height:6px;background:#2a5b3d}.cursor-ring{width:32px;height:32px;border:1px solid #20201e;transition:width .25s,height .25s,border-color .25s,background .25s}.cursor-ring.active{width:64px;height:64px;border-color:#2a5b3d;background:rgba(42,91,61,.1)}@media(max-width:700px){html:has(.cursor),html:has(.cursor) *{cursor:auto !important}.cursor,.cursor-ring{display:none}}::view-transition-old(root){animation:page-out .35s ease both}::view-transition-new(root){animation:page-in .55s cubic-bezier(.2,.7,.2,1) both}@keyframes page-out{to{opacity:0;transform:translateY(-14px)}}@keyframes page-in{from{opacity:0;transform:translateY(18px)}}';
  document.head.appendChild(transitionStyle);

  function initializeCursor() {
    if (document.querySelector('.cursor')) return;
    const cursor = document.createElement('div');
    const ring = document.createElement('div');
    cursor.className = 'cursor';
    ring.className = 'cursor-ring';
    document.body.append(cursor, ring);
    window.addEventListener('mousemove', event => {
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
      ring.style.left = `${event.clientX}px`;
      ring.style.top = `${event.clientY}px`;
    });
    document.querySelectorAll('a,button').forEach(element => {
      element.addEventListener('mouseenter', () => ring.classList.add('active'));
      element.addEventListener('mouseleave', () => ring.classList.remove('active'));
    });
  }

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
      initializeCursor();
      await executePageScripts(document.body);
      const destination = new URL(url, location.href);
      const savedScroll = sessionStorage.getItem(`fariello-scroll:${destination.pathname}${destination.hash}`);
      const destinationSection = routeSections[destination.pathname];
      if (destination.hash) {
        requestAnimationFrame(() => document.querySelector(destination.hash)?.scrollIntoView({ behavior: 'instant', block: 'start' }));
      } else if (destinationSection) {
        const catalogScroll = destination.pathname === '/catalogo' ? sessionStorage.getItem('fariello-catalogo-scroll') : null;
        requestAnimationFrame(() => {
          if (catalogScroll !== null) {
            const restoreCatalogScroll = () => window.scrollTo(0, Number(catalogScroll));
            restoreCatalogScroll();
            window.setTimeout(restoreCatalogScroll, 250);
            window.setTimeout(() => {
              restoreCatalogScroll();
              sessionStorage.removeItem('fariello-catalogo-scroll');
            }, 800);
          } else {
            document.getElementById(destinationSection)?.scrollIntoView({ behavior: 'instant', block: 'start' });
          }
        });
      } else {
        if (shouldResetScroll(destination.pathname)) {
          window.scrollTo(0, 0);
        } else {
          window.scrollTo(0, savedScroll ? Number(savedScroll) : (history.state && Number.isFinite(history.state.scrollY) ? history.state.scrollY : 0));
        }
      }
    };
    if (document.startViewTransition) await document.startViewTransition(update).finished;
    else await update();
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || link.target === '_blank' || link.origin !== location.origin) return;
    const url = new URL(link.href);
    if (url.pathname === '/product.html') {
      sessionStorage.setItem('fariello-return-url', `${location.pathname}${location.search}${location.hash}`);
      if (location.pathname === '/catalogo') sessionStorage.setItem('fariello-catalogo-scroll', String(window.scrollY));
      return;
    }
    if (link.classList.contains('back')) {
      event.preventDefault();
      const isLegalPage = legalPages.includes(location.pathname);
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
  initializeCursor();
  scrollToRouteSection(location.pathname);
  window.addEventListener('popstate', () => {
    normalizeHashRoute();
    scrollToRouteSection(location.pathname);
    navigate(location.href, false).catch(() => location.reload());
  });
})();
