import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { courseLevels, getCategories, type CourseFilters } from "../api/courses";

export default function CatalogFilters({ onApply }: { onApply: (filters: CourseFilters) => void }) {
  const [error, setError] = useState("");
  const categories = useQuery({
    queryKey: ["course-categories"],
    queryFn: ({ signal }) => getCategories(signal),
    retry: false,
  });

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const minimum = form.get("price_min");
    const maximum = form.get("price_max");
    const priceMin = minimum ? Number(minimum) : undefined;
    const priceMax = maximum ? Number(maximum) : undefined;

    if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) {
      setError("Цена «до» должна быть не меньше цены «от».");
      return;
    }

    setError("");
    onApply({
      search: String(form.get("search")).trim() || undefined,
      category_id: Number(form.get("category_id")) || undefined,
      level: (form.get("level") || undefined) as CourseFilters["level"],
      price_min: priceMin,
      price_max: priceMax,
      sort: form.get("sort") as CourseFilters["sort"],
    });
  }

  return (
    <form
      className="catalog-filters"
      role="search"
      aria-label="Поиск и фильтры курсов"
      onSubmit={applyFilters}
      onReset={() => {
        setError("");
        onApply({});
      }}
    >
      <label className="catalog-search">
        Поиск
        <input type="search" name="search" placeholder="Название или описание курса" />
      </label>
      <label>
        Категория
        <select name="category_id" disabled={!categories.data}>
          <option value="">{categories.isPending ? "Загрузка…" : "Все категории"}</option>
          {categories.data?.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <label>
        Уровень
        <select name="level">
          <option value="">Любой уровень</option>
          {Object.entries(courseLevels).map(([level, name]) => <option key={level} value={level}>{name}</option>)}
        </select>
      </label>
      <label>
        Цена от, BYN
        <input type="number" name="price_min" min="0" step="0.01" inputMode="decimal" />
      </label>
      <label>
        Цена до, BYN
        <input type="number" name="price_max" min="0" step="0.01" inputMode="decimal" />
      </label>
      <label>
        Сортировка
        <select name="sort">
          <option value="newest">Сначала новые</option>
          <option value="popular">По популярности</option>
          <option value="price_asc">Сначала дешевле</option>
          <option value="price_desc">Сначала дороже</option>
        </select>
      </label>
      <div className="catalog-filter-actions">
        <button className="catalog-button catalog-apply" type="submit">Найти курсы</button>
        <button className="catalog-button" type="reset">Сбросить</button>
      </div>
      {categories.isError && (
        <div className="catalog-filter-feedback">
          <span role="status">Категории не загрузились.</span>
          <button className="catalog-button" type="button" onClick={() => void categories.refetch()}>
            Повторить загрузку категорий
          </button>
        </div>
      )}
      {error && <p className="catalog-filter-feedback login-error" role="alert">{error}</p>}
    </form>
  );
}
