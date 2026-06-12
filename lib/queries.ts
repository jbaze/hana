/**
 * Curated benchmark query set.
 *
 * `sqlHana` and `sqlPostgres` are logically identical; they differ only where
 * the dialects force it (date formatting functions). Each HANA statement
 * carries a `bench:<id>` comment tag so its engine-reported timing can be
 * located in M_SQL_PLAN_CACHE.
 *
 * Query `order-details` is deliberately transactional: a point lookup where
 * the column-store advantage mostly disappears and PostgreSQL may match or
 * win. Including it keeps the analysis honest rather than cherry-picked.
 */

export type QueryCategory = "analytical" | "transactional";

export interface BenchQuery {
  id: string;
  /** Macedonian title shown in the UI. */
  title: string;
  /** English description for the codebase/thesis appendix. */
  description: string;
  /** Short Macedonian sentence explaining why the result looks the way it does. */
  explanation: string;
  category: QueryCategory;
  sqlHana: string;
  sqlPostgres: string;
}

// Fixed sample order id for the transactional point lookup. The seed script
// generates sequential order ids, so this id exists in every scale preset.
export const SAMPLE_ORDER_ID = 123456;

export const queries: BenchQuery[] = [
  {
    id: "top-books",
    title: "Топ 10 најпродавани книги",
    description:
      "Top 10 best-selling books: join order_items with books and authors, sum quantities, order, limit.",
    explanation:
      "Агрегација врз ~750.000 ставки со спојување на три табели — колонската организација на HANA чита само потребните колони и агрегира врз компресирани податоци, па типично е значително побрза.",
    category: "analytical",
    sqlHana: `SELECT /* bench:top-books */ b.book_id, b.title, a.name AS author_name,
       SUM(oi.quantity) AS total_sold
FROM order_items oi
JOIN books b ON b.book_id = oi.book_id
JOIN authors a ON a.author_id = b.author_id
GROUP BY b.book_id, b.title, a.name
ORDER BY total_sold DESC
LIMIT 10`,
    sqlPostgres: `SELECT b.book_id, b.title, a.name AS author_name,
       SUM(oi.quantity) AS total_sold
FROM order_items oi
JOIN books b ON b.book_id = oi.book_id
JOIN authors a ON a.author_id = b.author_id
GROUP BY b.book_id, b.title, a.name
ORDER BY total_sold DESC
LIMIT 10`,
  },
  {
    id: "revenue-genre-month",
    title: "Приход по жанр по месец",
    description:
      "Revenue grouped by genre and calendar month across all order items.",
    explanation:
      "Групирање по две димензии (жанр и месец) врз целата историја на продажби — класично OLAP прашање каде in-memory колонскиот пристап на HANA доаѓа до израз.",
    category: "analytical",
    sqlHana: `SELECT /* bench:revenue-genre-month */ b.genre,
       TO_VARCHAR(o.ordered_at, 'YYYY-MM') AS month,
       SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi
JOIN orders o ON o.order_id = oi.order_id
JOIN books b ON b.book_id = oi.book_id
GROUP BY b.genre, TO_VARCHAR(o.ordered_at, 'YYYY-MM')
ORDER BY month, genre`,
    sqlPostgres: `SELECT b.genre,
       TO_CHAR(o.ordered_at, 'YYYY-MM') AS month,
       SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi
JOIN orders o ON o.order_id = oi.order_id
JOIN books b ON b.book_id = oi.book_id
GROUP BY b.genre, TO_CHAR(o.ordered_at, 'YYYY-MM')
ORDER BY month, genre`,
  },
  {
    id: "avg-rating-genre",
    title: "Просечна оценка по жанр",
    description: "Average review rating per genre (join reviews to books).",
    explanation:
      "Спојување на 150.000 рецензии со книгите и агрегација по жанр — скенирање на две колони низ голема табела, погодно за колонска база.",
    category: "analytical",
    sqlHana: `SELECT /* bench:avg-rating-genre */ b.genre,
       COUNT(r.review_id) AS review_count,
       ROUND(AVG(TO_DECIMAL(r.rating, 10, 4)), 2) AS avg_rating
FROM reviews r
JOIN books b ON b.book_id = r.book_id
GROUP BY b.genre
ORDER BY avg_rating DESC`,
    sqlPostgres: `SELECT b.genre,
       COUNT(r.review_id) AS review_count,
       ROUND(AVG(r.rating::numeric), 2) AS avg_rating
FROM reviews r
JOIN books b ON b.book_id = r.book_id
GROUP BY b.genre
ORDER BY avg_rating DESC`,
  },
  {
    id: "stock-value-genre",
    title: "Вредност на залиха по жанр",
    description:
      "Total inventory value (price × stock) aggregated per genre over the books table.",
    explanation:
      "Агрегација врз 30.000 книги — релативно мала табела, па разликата меѓу базите е помала отколку кај прашањата врз милионските табели.",
    category: "analytical",
    sqlHana: `SELECT /* bench:stock-value-genre */ genre,
       COUNT(*) AS book_count,
       SUM(price * stock) AS stock_value
FROM books
GROUP BY genre
ORDER BY stock_value DESC`,
    sqlPostgres: `SELECT genre,
       COUNT(*) AS book_count,
       SUM(price * stock) AS stock_value
FROM books
GROUP BY genre
ORDER BY stock_value DESC`,
  },
  {
    id: "loyal-no-review",
    title: "Купувачи со над 5 нарачки без ниту една рецензија",
    description:
      "Customers with more than 5 orders who never wrote a review (anti-join via NOT EXISTS).",
    explanation:
      "Anti-join (NOT EXISTS) меѓу купувачи, нарачки и рецензии — комплексен план на извршување каде оптимизаторите на двете бази постапуваат различно.",
    category: "analytical",
    sqlHana: `SELECT /* bench:loyal-no-review */ c.customer_id, c.name, c.city,
       COUNT(o.order_id) AS order_count
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
WHERE NOT EXISTS (
  SELECT 1 FROM reviews r WHERE r.customer_id = c.customer_id
)
GROUP BY c.customer_id, c.name, c.city
HAVING COUNT(o.order_id) > 5
ORDER BY order_count DESC
LIMIT 50`,
    sqlPostgres: `SELECT c.customer_id, c.name, c.city,
       COUNT(o.order_id) AS order_count
FROM customers c
JOIN orders o ON o.customer_id = c.customer_id
WHERE NOT EXISTS (
  SELECT 1 FROM reviews r WHERE r.customer_id = c.customer_id
)
GROUP BY c.customer_id, c.name, c.city
HAVING COUNT(o.order_id) > 5
ORDER BY order_count DESC
LIMIT 50`,
  },
  {
    id: "monthly-revenue",
    title: "Месечен тренд на приход",
    description: "Monthly revenue time series over all orders.",
    explanation:
      "Временска серија врз целата табела со ставки — типично аналитичко прашање за извештаи, каде колонското скенирање на HANA е во предност.",
    category: "analytical",
    sqlHana: `SELECT /* bench:monthly-revenue */ TO_VARCHAR(o.ordered_at, 'YYYY-MM') AS month,
       COUNT(DISTINCT o.order_id) AS order_count,
       SUM(oi.quantity * oi.unit_price) AS revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
GROUP BY TO_VARCHAR(o.ordered_at, 'YYYY-MM')
ORDER BY month`,
    sqlPostgres: `SELECT TO_CHAR(o.ordered_at, 'YYYY-MM') AS month,
       COUNT(DISTINCT o.order_id) AS order_count,
       SUM(oi.quantity * oi.unit_price) AS revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
GROUP BY TO_CHAR(o.ordered_at, 'YYYY-MM')
ORDER BY month`,
  },
  {
    id: "order-details",
    title: "Детали за една нарачка по ID",
    description:
      "Transactional point lookup: full details of a single order by primary key.",
    explanation:
      "Трансакциско пребарување по примарен клуч — тука предноста на колонската организација исчезнува, а PostgreSQL со B-tree индекс често е изедначен или побрз. Вклучено е намерно: анализата е чесна, не селективна.",
    category: "transactional",
    sqlHana: `SELECT /* bench:order-details */ o.order_id, o.ordered_at,
       c.name AS customer_name, c.email, c.city,
       b.title, oi.quantity, oi.unit_price,
       oi.quantity * oi.unit_price AS line_total
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
JOIN order_items oi ON oi.order_id = o.order_id
JOIN books b ON b.book_id = oi.book_id
WHERE o.order_id = ${SAMPLE_ORDER_ID}`,
    sqlPostgres: `SELECT o.order_id, o.ordered_at,
       c.name AS customer_name, c.email, c.city,
       b.title, oi.quantity, oi.unit_price,
       oi.quantity * oi.unit_price AS line_total
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
JOIN order_items oi ON oi.order_id = o.order_id
JOIN books b ON b.book_id = oi.book_id
WHERE o.order_id = ${SAMPLE_ORDER_ID}`,
  },
];

export function getQuery(id: string): BenchQuery | undefined {
  return queries.find((q) => q.id === id);
}
