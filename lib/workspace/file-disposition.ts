export function workspaceFileDisposition(name:string,inline=false) {
  const encoded = encodeURIComponent(name).replace(/['()*]/g,c=>`%${c.charCodeAt(0).toString(16)}`);
  return `${inline?"inline":"attachment"}; filename="document.pdf"; filename*=UTF-8''${encoded}`;
}
