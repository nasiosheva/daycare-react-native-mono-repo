// Mories Deo Hutapea,S.E.,S.Kom
const loopbackHostnames = new Set(["localhost", "127.0.0.1", "::1"]);

export function isSecureBrowserOrigin(protocol: string, hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return protocol === "https:" || loopbackHostnames.has(normalizedHostname) || normalizedHostname.endsWith(".localhost");
}
