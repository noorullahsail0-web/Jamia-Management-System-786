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

  // Even more aggressive regex to catch unsupported CSS functions
  const colorFunctions = ['oklch', 'oklab', 'lch', 'hwb', 'light-dark', 'color-mix', 'relative-color'];
  const regexValue = colorFunctions.join('|');
  // Improved regex to handle potentially nested parentheses by matching until a terminator or a reasonable limit
  const colorRegex = new RegExp(`(?:${regexValue})\\s*\\((?:[^()]*|\\([^()]*\\))*\\)`, 'gi');

  // 1. Sanitize all <style> tags by literal replacement
  const styleTags = Array.from(clonedDoc.getElementsByTagName('style'));
  styleTags.forEach(tag => {
    if (tag.innerHTML.match(new RegExp(regexValue, 'i'))) {
      // First replace any explicit oklch/oklab calls with a safe emerald color
      tag.innerHTML = tag.innerHTML.replace(colorRegex, EMERALD[600]);
      
      // Specifically target Tailwind 4 variables and any CSS variable assigned these functions
      tag.innerHTML = tag.innerHTML.replace(/--[\w-]+\s*:\s*[^;}]*?(?:oklch|oklab|lch|hwb|light-dark|color-mix|relative-color)[^;}]*?(?:;|}|\n|$)/gi, (match) => {
        const parts = match.split(':');
        const varName = parts[0].trim();
        
        let replacement = EMERALD[600];
        const lowerVar = varName.toLowerCase();
        if (lowerVar.includes('-50')) replacement = EMERALD[50];
        else if (lowerVar.includes('-100')) replacement = EMERALD[100];
        else if (lowerVar.includes('-200')) replacement = EMERALD[200];
        else if (lowerVar.includes('-300')) replacement = EMERALD[300];
        else if (lowerVar.includes('-400')) replacement = EMERALD[400];
        else if (lowerVar.includes('-500')) replacement = EMERALD[500];
        else if (lowerVar.includes('-700')) replacement = EMERALD[700];
        else if (lowerVar.includes('-800')) replacement = EMERALD[800];
        else if (lowerVar.includes('-900')) replacement = EMERALD[900];
        else if (lowerVar.includes('-950')) replacement = EMERALD[950];
        
        const terminator = match.match(/[;}]\s*$/)?.[0] || '';
        return `${varName}: ${replacement} !important${terminator}`;
      });
      
      // Secondary pass for any remaining oklch/oklab/etc strings in the style tag
      tag.innerHTML = tag.innerHTML.replace(/oklch\([^)]+\)/gi, EMERALD[600]);
      tag.innerHTML = tag.innerHTML.replace(/oklab\([^)]+\)/gi, EMERALD[600]);
    }
  });

  // 1.1 Remove link tags (external stylesheets)
  const linkTags = Array.from(clonedDoc.getElementsByTagName('link'));
  linkTags.forEach(link => {
    if (link.rel === 'stylesheet' || link.as === 'style' || link.href?.includes('tailwind')) {
      link.remove();
    }
  });

  // 1.2 Global string replacement in the HEAD to catch missed references in meta/other tags
  const headHtml = clonedDoc.head.innerHTML;
  if (headHtml.match(new RegExp(regexValue, 'i'))) {
    clonedDoc.head.innerHTML = headHtml.replace(colorRegex, EMERALD[600]);
  }

  // 2. Sanitize inline styles and all attributes of all elements
  const elements = clonedDoc.querySelectorAll('*');
  elements.forEach((el) => {
    if (el instanceof HTMLElement) {
      const inlineStyle = el.getAttribute('style');
      if (inlineStyle && inlineStyle.match(new RegExp(regexValue, 'i'))) {
        el.setAttribute('style', inlineStyle.replace(colorRegex, EMERALD[600]));
      }
      
      // Check every single attribute (Tailwind sometimes uses data-attributes for colors)
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        if (attr.value && typeof attr.value === 'string' && attr.value.match(new RegExp(regexValue, 'i'))) {
          attr.value = attr.value.replace(colorRegex, EMERALD[600]);
        }
      }
    }
  });

  // 3. Inject a heavy fallback stylesheet to override common Tailwind 4 variables globally
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
      
      --color-red-500: #ef4444 !important;
      --color-red-600: #dc2626 !important;
      --color-red-700: #b91c1c !important;
      
      --color-white: #ffffff !important;
      --color-black: #000000 !important;
      --color-gray-50: #f9fafb !important;
      --color-gray-100: #f3f4f6 !important;
      --color-gray-200: #e5e7eb !important;
      --color-gray-300: #d1d5db !important;
      --color-gray-400: #9ca3af !important;
      --color-gray-500: #6b7280 !important;
      --color-gray-600: #4b5563 !important;
      
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

  // 4. Force specific class-to-color mapping for elements to be 100% sure html2canvas sees hex/rgb
  const colorMap: Record<string, string> = {
    'bg-emerald-950': '#022c22',
    'bg-emerald-900': '#064e3b',
    'bg-emerald-800': '#065f46',
    'bg-emerald-700': '#047857',
    'bg-emerald-600': '#10b981',
    'bg-emerald-500': '#10b981',
    'bg-emerald-50': '#ecfdf5',
    'text-emerald-950': '#022c22',
    'text-emerald-900': '#064e3b',
    'text-emerald-800': '#065f46',
    'text-emerald-700': '#047857',
    'text-emerald-600': '#059669',
    'border-emerald-900': '#064e3b',
    'border-emerald-800': '#065f46',
    'border-emerald-300': '#6ee7b7',
    'bg-emerald-50/20': 'rgba(236, 253, 245, 0.2)',
    'bg-emerald-50/50': 'rgba(236, 253, 245, 0.5)',
    'bg-emerald-100/50': 'rgba(209, 250, 229, 0.5)',
  };

  elements.forEach((el) => {
    if (el instanceof HTMLElement) {
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
    }
  });
}
