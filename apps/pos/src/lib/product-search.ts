import { LocalProduct } from "@/lib/db";

export interface SearchableProduct {
  product: LocalProduct;
  name: string;
  sku: string;
  barcode: string;
  description: string;
  category: string;
}

export const PRODUCT_SEARCH_LIMIT = 50;

export function buildSearchIndex(
  products: LocalProduct[],
): SearchableProduct[] {
  const index: SearchableProduct[] = new Array(products.length);
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    index[i] = {
      product,
      name: product.name?.toLowerCase() ?? "",
      sku: product.sku?.toLowerCase() ?? "",
      barcode: product.barcode?.toLowerCase() ?? "",
      description: product.description?.toLowerCase() ?? "",
      category: product.category ?? "",
    };
  }
  return index;
}

export function searchIndexedProducts(
  index: SearchableProduct[],
  query: string,
  category: string,
  limit: number = PRODUCT_SEARCH_LIMIT,
): { results: LocalProduct[]; hasMore: boolean } {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const filterByCategory = category !== "All";
  const results: LocalProduct[] = [];

  for (let i = 0; i < index.length; i++) {
    const row = index[i];
    if (filterByCategory && row.category !== category) continue;

    if (terms.length > 0) {
      let matches = true;
      for (let t = 0; t < terms.length; t++) {
        const term = terms[t];
        if (
          !row.name.includes(term) &&
          !row.sku.includes(term) &&
          !row.barcode.includes(term) &&
          !row.description.includes(term)
        ) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;
    }

    if (results.length >= limit) {
      return { results, hasMore: true };
    }
    results.push(row.product);
  }

  return { results, hasMore: false };
}

export function uniqueCategories(index: SearchableProduct[]): string[] {
  const seen = new Set<string>();
  for (let i = 0; i < index.length; i++) {
    const category = index[i].category;
    if (category) seen.add(category);
  }
  return ["All", ...Array.from(seen).sort()];
}
