const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "BR", "CODE", "UL", "OL", "LI"]);

export function sanitizeCardHtml(html: string): string {
  if (typeof window === "undefined") return html;

  const doc = new DOMParser().parseFromString(html, "text/html");
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const nodes: Element[] = [];

  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Element);
  }

  for (const node of nodes) {
    for (const attribute of Array.from(node.attributes)) {
      node.removeAttribute(attribute.name);
    }

    if (!ALLOWED_TAGS.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
    }
  }

  return doc.body.innerHTML;
}
