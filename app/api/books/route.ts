import { NextRequest, NextResponse } from "next/server";
import { withHana } from "@/lib/db/hana";
import { BooksResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

/** Searchable, paginated catalog served from SAP HANA. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const search = (params.get("search") ?? "").trim().slice(0, 100);
  const genre = (params.get("genre") ?? "").trim().slice(0, 50);
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);

  try {
    const data = await withHana(async (conn) => {
      const where: string[] = [];
      const args: unknown[] = [];
      if (search) {
        where.push("(LOWER(b.title) LIKE ? OR LOWER(a.name) LIKE ?)");
        const like = `%${search.toLowerCase()}%`;
        args.push(like, like);
      }
      if (genre) {
        where.push("b.genre = ?");
        args.push(genre);
      }
      const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

      const [countRow] = await conn.exec<{ CNT: number }>(
        `SELECT COUNT(*) AS CNT
         FROM books b JOIN authors a ON a.author_id = b.author_id
         ${whereSql}`,
        args
      );
      const total = Number(countRow.CNT);

      const offset = (page - 1) * PAGE_SIZE;
      const rows = await conn.exec<{
        BOOK_ID: number;
        TITLE: string;
        AUTHOR: string;
        GENRE: string;
        PRICE: number;
        STOCK: number;
        PUBLISHED_YEAR: number | null;
        AVG_RATING: number | null;
      }>(
        `SELECT b.book_id AS BOOK_ID, b.title AS TITLE, a.name AS AUTHOR,
                b.genre AS GENRE, b.price AS PRICE, b.stock AS STOCK,
                b.published_year AS PUBLISHED_YEAR,
                (SELECT ROUND(AVG(TO_DECIMAL(r.rating, 10, 4)), 1)
                 FROM reviews r WHERE r.book_id = b.book_id) AS AVG_RATING
         FROM books b JOIN authors a ON a.author_id = b.author_id
         ${whereSql}
         ORDER BY b.title
         LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
        args
      );

      const genreRows = await conn.exec<{ GENRE: string }>(
        `SELECT DISTINCT genre AS GENRE FROM books ORDER BY genre`
      );

      const payload: BooksResponse = {
        books: rows.map((r) => ({
          bookId: Number(r.BOOK_ID),
          title: r.TITLE,
          author: r.AUTHOR,
          genre: r.GENRE,
          price: Number(r.PRICE),
          stock: Number(r.STOCK),
          publishedYear: r.PUBLISHED_YEAR === null ? null : Number(r.PUBLISHED_YEAR),
          avgRating: r.AVG_RATING === null ? null : Number(r.AVG_RATING),
        })),
        total,
        page,
        pageSize: PAGE_SIZE,
        genres: genreRows.map((r) => r.GENRE),
      };
      return payload;
    });

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    );
  }
}
