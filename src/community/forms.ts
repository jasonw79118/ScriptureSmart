export function formValues(form: HTMLFormElement) {
  return Object.fromEntries(
    [...new FormData(form)].map(([key, value]) => [key, String(value).trim()]),
  );
}
