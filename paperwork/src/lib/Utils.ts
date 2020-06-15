export function sleep(ms: number) {
  return new Promise(fulfill => setTimeout(fulfill, ms));
}
