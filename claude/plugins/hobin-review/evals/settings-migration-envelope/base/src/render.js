export function render(template, vars) {
  const text = template.payload.body.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
  return template.payload.footer ? `${text}\n${template.payload.footer}` : text;
}
