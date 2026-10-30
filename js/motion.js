const motionSelector = [
    '.page-heading',
    '.sheets-status',
    '.kpi-card',
    '.panel',
    '.card-box',
    '.catalog-tabs',
    '.catalog-view-header',
    '.reception-line',
    '#pending-movement',
    '.pagination',
    'details',
].join(',');

let motionStarted = false;

export function setupMotion() {
    if (motionStarted || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    motionStarted = true;

    let order = 0;
    const reveal = element => {
        element.classList.add('motion-visible');
        const finish = () => {
            element.classList.remove('motion-ready', 'motion-visible');
            element.style.removeProperty('--motion-delay');
        };
        element.addEventListener('transitionend', finish, { once: true });
        window.setTimeout(finish, 900);
    };
    const intersection = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            reveal(entry.target);
            intersection.unobserve(entry.target);
        }
    }, { threshold: 0.06, rootMargin: '0px 0px -18px 0px' }) : null;

    const prepare = element => {
        if (!(element instanceof Element) || element.classList.contains('motion-ready')) return;
        element.classList.add('motion-ready');
        element.style.setProperty('--motion-delay', `${Math.min(order++ % 5, 4) * 45}ms`);
        if (intersection) intersection.observe(element);
        else reveal(element);
    };

    const discover = node => {
        if (!(node instanceof Element)) return;
        if (node.matches(motionSelector)) prepare(node);
        node.querySelectorAll(motionSelector).forEach(prepare);
    };

    discover(document.documentElement);
    const mutations = new MutationObserver(records => {
        for (const record of records) record.addedNodes.forEach(discover);
    });
    mutations.observe(document.getElementById('app-root') || document.body, { childList: true, subtree: true });

    window.addEventListener('pagehide', () => {
        mutations.disconnect();
        intersection?.disconnect();
    }, { once: true });
}
