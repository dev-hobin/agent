// The upstream catalog API answers { rows: [...] } on success.
export function parseRows(body) {
  if (!body || !Array.isArray(body.rows)) {
    throw new Error('upstream response is missing the rows envelope');
  }
  return body.rows;
}
