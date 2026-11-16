const priceFormat = new Intl.NumberFormat("ru-BY", {
  style: "currency",
  currency: "BYN",
});

export function formatCoursePrice(price: number | string) {
  const amount = Number(price);
  return amount === 0 ? "Бесплатно" : priceFormat.format(amount);
}
