// node 測試用：把 cloudflare:email 指到假的 EmailMessage
export async function resolve(specifier, context, next) {
  if (specifier === 'cloudflare:email') return { url: 'data:text/javascript,export class EmailMessage { constructor(from, to, raw) { this.from = from; this.to = to; this.raw = raw; } }', shortCircuit: true };
  return next(specifier, context);
}
