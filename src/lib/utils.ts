import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function compressImage(file: File, maxWidth = 400, maxHeight = 400, quality = 0.5): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

export function sanitizeHtml2Canvas(clonedDoc: Document) {
  try {
    // Common colors to use as fallbacks for Tailwind emerald palette
    const EMERALD = {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
      950: '#022c22',
    };

    const GRAY = {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#e5e5e5',
      300: '#d4d4d4',
      400: '#a3a3a3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717',
      950: '#0a0a0a',
    };

    const AMBER = {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
      950: '#451a03',
    };

    const RED = {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
      950: '#450a0a',
    };

    const SKY = {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
      950: '#082f49',
    };

    const TEAL = {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
      950: '#042f2e',
    };

    const colorFunctions = ['oklch', 'oklab', 'lch', 'hwb', 'light-dark', 'color-mix', 'relative-color'];
    const regexValue = colorFunctions.join('|');
    // Fast, non-backtracking RegExp to replace any color function calls safely
    const colorRegex = /(?:oklch|oklab|lch|hwb|light-dark|color-mix|relative-color)\s*\([^)]*\)/gi;

    const processCssText = (cssText: string) => {
      if (!cssText) return cssText;
      
      // 1. Substitute variables with their proper color palette values FIRST
      let newCss = cssText.replace(/--[\w-]+\s*:\s*[^;}]*?(?:oklch|oklab|lch|hwb|light-dark|color-mix|relative-color)[^;}]*?(?:;|}|\n|$)/gi, (match) => {
        const parts = match.split(':');
        const varName = parts[0].trim();
        const lowerVar = varName.toLowerCase();
        
        let palette = EMERALD;
        if (lowerVar.includes('gray') || lowerVar.includes('neutral') || lowerVar.includes('slate') || lowerVar.includes('zinc')) {
          palette = GRAY;
        } else if (lowerVar.includes('amber') || lowerVar.includes('yellow')) {
          palette = AMBER;
        } else if (lowerVar.includes('red')) {
          palette = RED;
        } else if (lowerVar.includes('sky') || lowerVar.includes('blue')) {
          palette = SKY;
        } else if (lowerVar.includes('teal')) {
          palette = TEAL;
        }
        
        let replacement = palette[600];
        if (lowerVar.includes('-50')) replacement = palette[50];
        else if (lowerVar.includes('-100')) replacement = palette[100];
        else if (lowerVar.includes('-200')) replacement = palette[200];
        else if (lowerVar.includes('-300')) replacement = palette[300];
        else if (lowerVar.includes('-400')) replacement = palette[400];
        else if (lowerVar.includes('-500')) replacement = palette[500];
        else if (lowerVar.includes('-600')) replacement = palette[600];
        else if (lowerVar.includes('-700')) replacement = palette[700];
        else if (lowerVar.includes('-800')) replacement = palette[800];
        else if (lowerVar.includes('-900')) replacement = palette[900];
        else if (lowerVar.includes('-950')) replacement = palette[950];
        else if (lowerVar.includes('white')) replacement = '#ffffff';
        else if (lowerVar.includes('black')) replacement = '#000000';
        
        const terminator = match.match(/[;}]\s*$/)?.[0] || '';
        return `${varName}: ${replacement} !important${terminator}`;
      });

      // 2. Convert color-mix opacity patterns to standard rgb/rgba to ensure support
      newCss = newCss.replace(/color-mix\s*\(\s*in\s+srgb\s*,\s*var\(--color-black\)\s+(\d+(?:\.\d+)?)%\s*,\s*transparent\s*\)/gi, (m, p) => {
        const alpha = parseFloat(p) / 100;
        return `rgba(0,0,0,${alpha})`;
      });
      newCss = newCss.replace(/color-mix\s*\(\s*in\s+srgb\s*,\s*var\(--color-white\)\s+(\d+(?:\.\d+)?)%\s*,\s*transparent\s*\)/gi, (m, p) => {
        const alpha = parseFloat(p) / 100;
        return `rgba(255,255,255,${alpha})`;
      });
      newCss = newCss.replace(/color-mix\s*\(\s*in\s+srgb\s*,\s*var\(--color-emerald-100\)\s+(\d+(?:\.\d+)?)%\s*,\s*transparent\s*\)/gi, "rgba(209, 250, 229, 0.3)");
      newCss = newCss.replace(/color-mix\s*\(\s*in\s+srgb\s*,\s*var\(--color-emerald-900\)\s+(\d+(?:\.\d+)?)%\s*,\s*transparent\s*\)/gi, "rgba(6, 78, 59, 0.1)");

      // 3. Last resort: replace any lingering oklch calls with a safe emerald color
      newCss = newCss.replace(colorRegex, EMERALD[600]);

      return newCss;
    };

    // 1. Sanitize all <style> tags by literal replacement
    const styleTags = Array.from(clonedDoc.getElementsByTagName('style'));
    styleTags.forEach(tag => {
      try {
        const cssText = tag.innerHTML;
        if (cssText && cssText.match(new RegExp(regexValue, 'i'))) {
          tag.innerHTML = processCssText(cssText);
        }
      } catch (styleErr) {
        console.warn("Failsafe: error sanitizing a style tag:", styleErr);
      }
    });

    // 1.1 Process link tags: synchronously fetch same-origin templates & inline them to prevent CORS and sanitize oklch
    const linkTags = Array.from(clonedDoc.getElementsByTagName('link'));
    linkTags.forEach(link => {
      try {
        if (link.rel === 'stylesheet' || link.as === 'style') {
          const href = link.getAttribute('href') || '';
          const isAbsolute = href.includes('://') || href.startsWith('//');
          const isSameOrigin = !isAbsolute || href.startsWith(window.location.origin);
          
          if (isSameOrigin) {
            // Synchronously fetch same-origin stylesheet
            const xhr = new XMLHttpRequest();
            xhr.open('GET', href, false);
            xhr.send(null);
            
            if (xhr.status === 200 && xhr.responseText) {
              const cssText = xhr.responseText;
              const inlineStyle = clonedDoc.createElement('style');
              inlineStyle.innerHTML = processCssText(cssText);
              clonedDoc.head.appendChild(inlineStyle);
            }
          }
          // Remove link tag in all cases to prevent html2canvas from failing CORS fetch
          link.remove();
        }
      } catch (linkErr) {
        console.warn("Failsafe: error checking/processing link tag:", linkErr);
        try {
          link.remove();
        } catch (e) {}
      }
    });

    // 1.2 Global string replacement in the HEAD to catch missed references
    try {
      const headHtml = clonedDoc.head.innerHTML;
      if (headHtml && headHtml.match(new RegExp(regexValue, 'i'))) {
        clonedDoc.head.innerHTML = processCssText(headHtml);
      }
    } catch (headErr) {
      console.warn("Failsafe: error processing head HTML:", headErr);
    }

    // 2. Sanitize inline styles of elements (no aggressive attribute loop to avoid crash)
    const elements = clonedDoc.querySelectorAll('*');
    elements.forEach((el) => {
      if (el instanceof HTMLElement) {
        try {
          const inlineStyle = el.getAttribute('style');
          if (inlineStyle && inlineStyle.match(new RegExp(regexValue, 'i'))) {
            el.setAttribute('style', processCssText(inlineStyle));
          }
        } catch (elErr) {
          // ignore element level error
        }
      }
    });

    // 3. Inject a heavy fallback stylesheet to override common Tailwind 4 variables globally
    try {
      const fallbackStyle = clonedDoc.createElement('style');
      fallbackStyle.innerHTML = `
        *, ::before, ::after {
          /* Force override all problematic color variables */
          --color-emerald-50: ${EMERALD[50]} !important;
          --color-emerald-100: ${EMERALD[100]} !important;
          --color-emerald-200: ${EMERALD[200]} !important;
          --color-emerald-300: ${EMERALD[300]} !important;
          --color-emerald-400: ${EMERALD[400]} !important;
          --color-emerald-500: ${EMERALD[500]} !important;
          --color-emerald-600: ${EMERALD[600]} !important;
          --color-emerald-700: ${EMERALD[700]} !important;
          --color-emerald-800: ${EMERALD[800]} !important;
          --color-emerald-900: ${EMERALD[900]} !important;
          --color-emerald-950: ${EMERALD[950]} !important;
          
          --color-amber-50: ${AMBER[50]} !important;
          --color-amber-100: ${AMBER[100]} !important;
          --color-amber-200: ${AMBER[200]} !important;
          --color-amber-300: ${AMBER[300]} !important;
          --color-amber-400: ${AMBER[400]} !important;
          --color-amber-500: ${AMBER[500]} !important;
          --color-amber-600: ${AMBER[600]} !important;
          --color-amber-700: ${AMBER[700]} !important;
          --color-amber-800: ${AMBER[800]} !important;
          --color-amber-900: ${AMBER[900]} !important;
          --color-amber-950: ${AMBER[950]} !important;

          --color-red-50: ${RED[50]} !important;
          --color-red-100: ${RED[100]} !important;
          --color-red-200: ${RED[200]} !important;
          --color-red-300: ${RED[300]} !important;
          --color-red-400: ${RED[400]} !important;
          --color-red-500: ${RED[500]} !important;
          --color-red-600: ${RED[600]} !important;
          --color-red-700: ${RED[700]} !important;
          --color-red-800: ${RED[800]} !important;
          --color-red-900: ${RED[900]} !important;
          --color-red-950: ${RED[950]} !important;

          --color-gray-50: ${GRAY[50]} !important;
          --color-gray-100: ${GRAY[100]} !important;
          --color-gray-200: ${GRAY[200]} !important;
          --color-gray-300: ${GRAY[300]} !important;
          --color-gray-400: ${GRAY[400]} !important;
          --color-gray-500: ${GRAY[500]} !important;
          --color-gray-600: ${GRAY[600]} !important;
          --color-gray-700: ${GRAY[700]} !important;
          --color-gray-800: ${GRAY[800]} !important;
          --color-gray-900: ${GRAY[900]} !important;
          --color-gray-950: ${GRAY[950]} !important;
          
          --color-white: #ffffff !important;
          --color-black: #000000 !important;
          
          /* Reset problematic internal Tailwind variables */
          --tw-ring-color: transparent !important;
          --tw-ring-shadow: none !important;
          --tw-shadow: none !important;
          --tw-shadow-colored: none !important;
          --tw-ring-offset-shadow: none !important;
          --tw-outline-style: none !important;
          --tw-ring-offset-width: 0 !important;
          --tw-ring-offset-color: transparent !important;
          
          /* Reset shadow-related variables that use oklch in TW4 */
          --tw-shadow-color: transparent !important;
          --tw-inset-shadow-color: transparent !important;
          --tw-ring-inset-shadow-color: transparent !important;
          
          /* Additional TW4 color variables that might cause issues */
          --color-primary: ${EMERALD[900]} !important;
          --color-primary-light: ${EMERALD[500]} !important;
        }
        
        html, body {
          background-color: white !important;
          color: black !important;
        }
      `;
      clonedDoc.head.appendChild(fallbackStyle);
    } catch (fallbackErr) {
      console.warn("Failsafe: error appending fallback styles:", fallbackErr);
    }

    // 4. Force specific class-to-color mapping for elements to be 100% sure html2canvas sees hex/rgb
    const colorMap: Record<string, string> = {
      'bg-emerald-955': '#022c22',
      'bg-emerald-950': '#022c22',
      'bg-emerald-900': '#064e3b',
      'bg-emerald-800': '#065f46',
      'bg-emerald-700': '#047857',
      'bg-emerald-600': '#10b981',
      'bg-emerald-500': '#10b981',
      'bg-emerald-400': '#34d399',
      'bg-emerald-300': '#6ee7b7',
      'bg-emerald-200': '#a7f3d0',
      'bg-emerald-100': '#d1fae5',
      'bg-emerald-50': '#ecfdf5',
      'text-emerald-955': '#022c22',
      'text-emerald-950': '#022c22',
      'text-emerald-900': '#064e3b',
      'text-emerald-800': '#065f46',
      'text-emerald-700': '#047857',
      'text-emerald-600': '#059669',
      'text-emerald-500': '#10b981',
      'border-emerald-900': '#064e3b',
      'border-emerald-800': '#065f46',
      'border-emerald-300': '#6ee7b7',
      'bg-emerald-50/20': 'rgba(236, 253, 245, 0.2)',
      'bg-emerald-50/50': 'rgba(236, 253, 245, 0.5)',
      'bg-emerald-100/30': 'rgba(209, 250, 229, 0.3)',
      'bg-emerald-100/50': 'rgba(209, 250, 229, 0.5)',
      'border-emerald-900/10': 'rgba(6, 78, 59, 0.1)',
      'border-emerald-900/20': 'rgba(6, 78, 59, 0.2)',
      'border-emerald-900/30': 'rgba(6, 78, 59, 0.3)',

      // Gray & Neutrals
      'bg-gray-50': '#fafafa',
      'bg-gray-100': '#f5f5f5',
      'bg-gray-200': '#e5e5e5',
      'bg-gray-300': '#d4d4d4',
      'bg-gray-400': '#a3a3a3',
      'bg-gray-500': '#737373',
      'bg-neutral-50': '#fafafa',
      'bg-neutral-100': '#f5f5f5',
      'bg-neutral-200': '#e5e5e5',
      'text-gray-500': '#737373',
      'text-gray-700': '#404040',
      'text-gray-900': '#171717',
      'border-gray-200': '#e5e5e5',
      'border-gray-300': '#d4d4d4',

      // Ambers (Result boxes & backgrounds)
      'bg-amber-50': '#fffbeb',
      'bg-amber-100': '#fef3c7',
      'bg-amber-200': '#fde68a',
      'bg-amber-500': '#f59e0b',
      'bg-amber-600': '#d97706',
      'bg-amber-700': '#b45309',
      'text-amber-900': '#78350f',
      'text-amber-800': '#92400e',
      'text-amber-700': '#b45309',
      'border-amber-200': '#fde68a',
      'border-amber-300': '#fcd34d',
      'border-amber-500': '#f59e0b',

      // Reds
      'bg-red-50': '#fef2f2',
      'bg-red-100': '#fee2e2',
      'bg-red-500': '#ef4444',
      'text-red-600': '#dc2626',
      'text-red-700': '#b91c1c',
      'border-red-200': '#fecaca',
    };

    elements.forEach((el) => {
      if (el instanceof HTMLElement) {
        try {
          Object.entries(colorMap).forEach(([className, color]) => {
            if (el.classList.contains(className)) {
              if (className.startsWith('bg-')) el.style.backgroundColor = color;
              else if (className.startsWith('text-')) el.style.color = color;
              else if (className.startsWith('border-')) el.style.borderColor = color;
            }
          });
          
          // Fix image display issues
          if (el.tagName === 'IMG') {
            el.style.display = 'block';
            (el as HTMLImageElement).referrerPolicy = 'no-referrer';
          }
          
          // Fix table border collapse which often breaks in html2canvas
          if (el.tagName === 'TABLE') {
            el.style.borderCollapse = 'collapse';
          }
        } catch (elMapErr) {
          // ignore
        }
      }
    });
  } catch (globalErr) {
    console.warn("Failsafe: global error in sanitizeHtml2Canvas:", globalErr);
  }
}
