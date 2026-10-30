const PLACEHOLDER = /\{(\w+)\}/g;

export function render(template, vars, { signature = '' } = {}) {
  const text = template.payload.body.replace(PLACEHOLDER, (_, key) => vars[key] ?? '');
  return signature ? `${text}\n${signature}` : text;
}
