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
  // More comprehensive regex to catch unsupported CSS functions
  // We use [\s\S]*? to handle multi-line function calls and anything inside the parentheses
  const colorRegex = /(?:oklch|oklab|lch|hwb|light-dark|color-mix)\s*\([\s\S]*?\)/gi;

  // 1. Sanitize all <style> tags by literal replacement
  const styleTags = clonedDoc.getElementsByTagName('style');
  for (let i = 0; i < styleTags.length; i++) {
    const tag = styleTags[i];
    if (tag.innerHTML.match(/(?:oklch|oklab|lch|hwb|light-dark)/i)) {
      tag.innerHTML = tag.innerHTML.replace(colorRegex, '#10b981');
      // Also catch where they might be assigned to variables with a semi-colon ending
      tag.innerHTML = tag.innerHTML.replace(/--[\w-]+\s*:\s*[^;}]*?(?:oklch|oklab|lch|hwb|light-dark)[^;}]*?;/gi, (match) => {
        const varName = match.split(':')[0];
        return `${varName.trim()}: #10b981;`;
      });
    }
  }

  // 2. Sanitize inline styles and all attributes of all elements
  const elements = clonedDoc.querySelectorAll('*');
  elements.forEach((el) => {
    if (el instanceof HTMLElement) {
      const inlineStyle = el.getAttribute('style');
      if (inlineStyle && inlineStyle.match(/(?:oklch|oklab|lch|hwb|light-dark)/i)) {
        el.setAttribute('style', inlineStyle.replace(colorRegex, '#10b981'));
      }
      
      // Also check every single attribute just in case (Tailwind sometimes uses data-attributes)
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        if (attr.value && attr.value.match(/(?:oklch|oklab|light-dark)/i)) {
          attr.value = attr.value.replace(colorRegex, '#10b981');
        }
      }
    }
  });

  // 3. Inject a heavy fallback stylesheet to override common Tailwind 4 variables
  const fallbackStyle = clonedDoc.createElement('style');
  fallbackStyle.innerHTML = `
    :root, [data-theme], body {
      --color-emerald-50: #ecfdf5 !important;
      --color-emerald-100: #d1fae5 !important;
      --color-emerald-200: #a7f3d0 !important;
      --color-emerald-300: #6ee7b7 !important;
      --color-emerald-400: #34d399 !important;
      --color-emerald-500: #10b981 !important;
      --color-emerald-600: #059669 !important;
      --color-emerald-700: #047857 !important;
      --color-emerald-800: #065f46 !important;
      --color-emerald-900: #064e3b !important;
      --color-emerald-950: #022c22 !important;
      
      --color-white: #ffffff !important;
      --color-black: #000000 !important;
      
      /* Reset problematic tailwind variables that cause parsing errors in older html2canvas */
      --tw-ring-color: #10b981 !important;
      --tw-ring-offset-color: #ffffff !important;
      --tw-shadow-color: #000000 !important;
      --tw-outline-color: #10b981 !important;
      --tw-border-color: #e5e7eb !important;
      --tw-bg-opacity: 1 !important;
      --tw-text-opacity: 1 !important;
      --tw-outline-style: none !important;
    }
    *, ::before, ::after {
      --tw-ring-shadow: none !important;
      --tw-shadow: none !important;
      --tw-shadow-colored: none !important;
      --tw-inset-shadow: none !important;
      --tw-inset-shadow-colored: none !important;
      --tw-ring-inset: none !important;
      --tw-ring-offset-width: 0px !important;
      outline: none !important;
      box-shadow: none !important;
    }
  `;
  clonedDoc.head.appendChild(fallbackStyle);
}
