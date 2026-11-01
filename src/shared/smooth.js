import { getSvgPath } from 'figma-squircle';
// One geometry for backgrounds, clipping, borders and focus states at every size.
export function observeSmoothCorners(root = document) {
  const observer = new ResizeObserver(entries => {
    for (const { target } of entries) {
      const { width, height } = target.getBoundingClientRect();
      if (!width || !height) continue;
      const radius = Number(target.dataset.radius || 10);
      const d = getSvgPath({ width, height, cornerRadius: radius, cornerSmoothing: 0.6 });
      target.style.clipPath = `path('${d}')`;
      const svg = target.querySelector(':scope > .smooth-border');
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.firstChild.setAttribute('d', d);
    }
  });
  root.querySelectorAll('.smooth').forEach(el => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('smooth-border'); svg.setAttribute('aria-hidden', 'true');
    svg.append(document.createElementNS(svg.namespaceURI, 'path'));
    el.append(svg); observer.observe(el);
  });
  return observer;
}
