// Browser/Electron only; native clients retain the built-in icon picker.
export function pickIconImage(): Promise<string | null> {
  const browser = globalThis as unknown as { document?: { createElement(tag: string): any }; FileReader: new () => any };
  if (!browser.document) return Promise.reject(new Error('Image upload is available in the desktop or web app.'));
  return new Promise((resolve, reject) => {
    const input = browser.document!.createElement('input');
    input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp';
    input.oncancel = () => resolve(null);
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 128 * 1024) {
        reject(new Error('Choose a PNG, JPEG, or WebP image smaller than 128 KB.')); return;
      }
      const reader = new browser.FileReader();
      reader.onerror = () => reject(new Error('Could not read the image.'));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
