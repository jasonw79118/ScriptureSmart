export function navigate(route: string) {
  window.location.assign(`#${route}`);
}
export function timestamp() {
  return new Date().toISOString();
}
export function exportText(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
