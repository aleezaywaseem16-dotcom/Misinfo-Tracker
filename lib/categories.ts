export function sortCategoriesOtherLast<T extends { name: string }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => {
    const aOther = a.name.trim().toLowerCase() === "other";
    const bOther = b.name.trim().toLowerCase() === "other";
    if (aOther !== bOther) return aOther ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}
