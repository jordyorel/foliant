export function movePageInOrder(currentOrder: number[], fromSourcePage: number, toSourcePage: number) {
  const fromIndex = currentOrder.indexOf(fromSourcePage);
  const targetIndex = currentOrder.indexOf(toSourcePage);

  if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return currentOrder;

  const nextOrder = [...currentOrder];
  const [movedPage] = nextOrder.splice(fromIndex, 1);

  nextOrder.splice(targetIndex, 0, movedPage);
  return nextOrder;
}
